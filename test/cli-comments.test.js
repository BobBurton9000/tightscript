import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

function configureSourceScope(project) {
  project.writeFile(
    "tightscript.config.json",
    JSON.stringify({ include: ["src/**/*.ts", "src/**/*.tsx"] }),
  );
}

function initializeGitRepository(project, trackedFilePaths = []) {
  execFileSync("git", ["init", "--quiet"], {
    cwd: project.cwd,
    stdio: "ignore",
  });
  if (trackedFilePaths.length > 0) {
    execFileSync("git", ["add", "--", ...trackedFilePaths], {
      cwd: project.cwd,
      stdio: "ignore",
    });
  }
}

test("CLI accepts the exact @see Markdown-link form in TypeScript comment forms [REQ-010]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile("src/guide.md", "# Guide\n");
  project.writeFile(
    "src/CommentForms.ts",
    `// @see [the guide](./guide.md)
const lineComment = 1;
/* @see [the guide](./guide.md) */
const blockComment = 2;
/**
 * @see [the guide](./guide.md)
 */
const documentationComment = 3;
`,
  );
  initializeGitRepository(project, ["src/guide.md"]);

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});

test("CLI rejects comment prose and extra Markdown content [REQ-010]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/InvalidComments.ts",
    `// explanatory prose
// @see [the guide](./guide.md) with extra prose
/* @see [first](./first.md) @see [second](./second.md) */
/** @see [the guide](./guide.md) [another](./other.md) */
`,
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(
    result.stderr
      .split("\n")
      .filter((line) => line.includes("[REQ-010]"))
      .map((line) => Number(line.match(/:(\d+):\d+ \[REQ-010\]/)?.[1])),
    [1, 2, 3, 4],
  );
  assert.ok(result.stderr.endsWith("FAIL\n"));
});

test("CLI does not treat strings that resemble comments as comments [REQ-010]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/CommentLookingStrings.ts",
    `const lineCommentText = "// explanatory prose";
const blockCommentText = "/* @see [fake](./fake.md) */";
const templateCommentText = \`// not a comment\`;
`,
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});

test("CLI reports suppression directives without suppressing other findings [REQ-009, REQ-014]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile("src/Suppression.ts", "// @ts-ignore\nlet forbidden = 1;\n");

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "src/Suppression.ts:1:1 [REQ-014] Suppression directives are not permitted; comments must not suppress policy violations.\n" +
      "src/Suppression.ts:2:1 [REQ-009] `let` declarations are not permitted.\n" +
      "FAIL\n",
  );
});

test("CLI resolves valid @see targets relative to the source file [REQ-011]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/nested/Source.ts",
    `/**
 * @see [guide](./docs/guide.md#quick-start)
 */
const value = 1;
`,
  );
  project.writeFile("src/nested/docs/guide.md", "# Reference\n\n## Quick start\n");
  initializeGitRepository(project, ["src/nested/docs/guide.md"]);

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});

test("CLI rejects missing, non-Markdown, untracked, and outside @see targets [REQ-012]", async (t) => {
  const invalidTargets = [
    { name: "missing target", kind: "missing" },
    { name: "non-Markdown target", kind: "non-markdown" },
    { name: "untracked Markdown target", kind: "untracked" },
    { name: "outside-repository target", kind: "outside" },
  ];

  for (const invalidTarget of invalidTargets) {
    await t.test(invalidTarget.name, (subtest) => {
      const project = createTemporaryProject(subtest);
      configureSourceScope(project);
      let linkTarget = "./missing.md";

      if (invalidTarget.kind === "non-markdown") {
        project.writeFile("src/guide.txt", "Not Markdown\n");
        linkTarget = "./guide.txt";
      }
      if (invalidTarget.kind === "untracked") {
        project.writeFile("src/guide.md", "# Guide\n");
        linkTarget = "./guide.md";
      }
      if (invalidTarget.kind === "outside") {
        const outsideDirectory = mkdtempSync(join(tmpdir(), "tightscript-outside-"));
        subtest.after(() => rmSync(outsideDirectory, { force: true, recursive: true }));
        const outsideTarget = join(outsideDirectory, "guide.md");
        writeFileSync(outsideTarget, "# Guide\n");
        linkTarget = relative(join(project.cwd, "src"), outsideTarget)
          .split(sep)
          .join("/");
      }

      project.writeFile(
        "src/Source.ts",
        `// @see [guide](${linkTarget})
const value = 1;
`,
      );
      initializeGitRepository(project);

      const result = runCli(project.cwd);

      assert.ifError(result.error);
      assert.equal(result.signal, null);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.ok(result.stderr.includes("[REQ-012]"));
      assert.ok(result.stderr.endsWith("FAIL\n"));
    });
  }
});

test("CLI checks @see symlinks using their final targets [REQ-011, REQ-012]", async (t) => {
  const targetCases = [
    {
      name: "tracked Markdown final target inside the repository",
      kind: "inside",
      expectedStatus: 0,
    },
    {
      name: "non-Markdown final target",
      kind: "non-markdown",
      expectedStatus: 1,
    },
    {
      name: "final target outside the repository",
      kind: "outside",
      expectedStatus: 1,
    },
  ];

  for (const targetCase of targetCases) {
    await t.test(targetCase.name, (subtest) => {
      const project = createTemporaryProject(subtest);
      configureSourceScope(project);
      project.writeFile(
        "src/Source.ts",
        `// @see [guide](./linked.md)
const value = 1;
`,
      );
      let symlinkTarget;
      let trackedFilePaths = [];

      if (targetCase.kind === "inside") {
        project.writeFile("docs/guide.md", "# Guide\n");
        symlinkTarget = "../docs/guide.md";
        trackedFilePaths = ["docs/guide.md"];
      }
      if (targetCase.kind === "non-markdown") {
        project.writeFile("docs/guide.txt", "Not Markdown\n");
        symlinkTarget = "../docs/guide.txt";
        trackedFilePaths = ["docs/guide.txt"];
      }
      if (targetCase.kind === "outside") {
        const outsideDirectory = mkdtempSync(join(tmpdir(), "tightscript-outside-"));
        subtest.after(() => rmSync(outsideDirectory, { force: true, recursive: true }));
        symlinkTarget = join(outsideDirectory, "guide.md");
        writeFileSync(symlinkTarget, "# Guide\n");
      }

      try {
        symlinkSync(symlinkTarget, join(project.cwd, "src/linked.md"));
      } catch (error) {
        if (["EACCES", "EPERM", "ENOSYS", "ENOTSUP", "EOPNOTSUPP"].includes(error.code)) {
          subtest.skip(`Symlink creation is unavailable (${error.code}).`);
          return;
        }
        throw error;
      }

      initializeGitRepository(project, trackedFilePaths);
      const result = runCli(project.cwd);

      assert.ifError(result.error);
      assert.equal(result.signal, null);
      assert.equal(result.status, targetCase.expectedStatus);
      if (targetCase.expectedStatus === 0) {
        assert.equal(result.stdout, "PASS\n");
        assert.equal(result.stderr, "");
        return;
      }
      assert.equal(result.stdout, "");
      assert.ok(result.stderr.includes("[REQ-012]"));
      assert.ok(result.stderr.endsWith("FAIL\n"));
    });
  }
});

test("CLI validates GitHub heading anchors and duplicate suffixes [REQ-013]", async (t) => {
  const fragmentCases = [
    { name: "duplicate heading suffix", fragment: "duplicate-heading-1", expectedStatus: 0 },
    { name: "punctuation and repeated whitespace", fragment: "many--spaces", expectedStatus: 0 },
    { name: "unknown duplicate suffix", fragment: "duplicate-heading-2", expectedStatus: 1 },
  ];

  for (const fragmentCase of fragmentCases) {
    await t.test(fragmentCase.name, (subtest) => {
      const project = createTemporaryProject(subtest);
      configureSourceScope(project);
      project.writeFile(
        "src/Source.ts",
        `// @see [guide](../docs/guide.md#${fragmentCase.fragment})
const value = 1;
`,
      );
      project.writeFile(
        "docs/guide.md",
        "# Reference\n\n## Duplicate *Heading*\n\n## Duplicate Heading\n\n## Many  Spaces!\n",
      );
      initializeGitRepository(project, ["docs/guide.md"]);

      const result = runCli(project.cwd);

      assert.ifError(result.error);
      assert.equal(result.signal, null);
      assert.equal(result.status, fragmentCase.expectedStatus);
      if (fragmentCase.expectedStatus === 0) {
        assert.equal(result.stdout, "PASS\n");
        assert.equal(result.stderr, "");
        return;
      }
      assert.equal(result.stdout, "");
      assert.ok(result.stderr.includes("[REQ-013]"));
      assert.ok(result.stderr.endsWith("FAIL\n"));
    });
  }
});

test("CLI fails evaluation when a valid @see link needs Git outside a repository [REQ-005]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile("docs/guide.md", "# Guide\n");
  project.writeFile(
    "src/Source.ts",
    `// @see [guide](../docs/guide.md)
const value = 1;
`,
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.ok(
    result.stderr.includes("[REQ-005] Evaluation error: Could not complete policy evaluation:"),
  );
  assert.ok(result.stderr.endsWith("FAIL\n"));
});
