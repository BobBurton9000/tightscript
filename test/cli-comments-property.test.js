import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

const PROPERTY_ID = "PROP-REQ-010-01";
const UNSUPPORTED_SYMLINK_ERRORS = new Set([
  "EACCES",
  "EPERM",
  "ENOSYS",
  "ENOTSUP",
  "EOPNOTSUPP",
]);

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
    });
  }
}

function assertPass(result) {
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
}

function assertFailure(result, requirementId) {
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.ok(result.stderr.includes(`[${requirementId}]`), result.stderr);
  assert.ok(result.stderr.endsWith("FAIL\n"), result.stderr);
}

test(`[${PROPERTY_ID}] TypeScript comment forms accept tracked source-relative links and GitHub anchors`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/nested/CommentForms.ts",
    "// @see [guide](./docs/guide.md#quick-start)\n" +
      "const lineCommentValue = 1; /* @see [guide](./docs/guide.md#duplicate-guide-1) */\n" +
      "/**\n" +
      " * @see [guide](./docs/guide.md#duplicate-guide-1)\n" +
      " */\n" +
      "const documentationCommentValue = 2;\n",
  );
  project.writeFile(
    "src/nested/docs/guide.md",
    "# Guide\n\n## Quick start\n\n## Duplicate Guide\n\n## Duplicate Guide\n",
  );
  initializeGitRepository(project, ["src/nested/docs/guide.md"]);

  const result = runCli(project.cwd);

  assertPass(result);
});

test(`[${PROPERTY_ID}] comments with prose or extra links fail`, async (t) => {
  const invalidComments = [
    { name: "prose without a link", source: "// explanatory prose\n" },
    {
      name: "prose after a valid link",
      source: "// @see [guide](./guide.md) with extra prose\n",
    },
    {
      name: "multiple links in one comment",
      source: "/* @see [guide](./guide.md) [another](./other.md) */\n",
    },
  ];

  for (const invalidComment of invalidComments) {
    await t.test(`[${PROPERTY_ID}] ${invalidComment.name}`, (subtest) => {
      const project = createTemporaryProject(subtest);
      configureSourceScope(project);
      project.writeFile("src/InvalidComment.ts", invalidComment.source);
      initializeGitRepository(project);

      const result = runCli(project.cwd);

      assertFailure(result, "REQ-010");
    });
  }
});

test(`[${PROPERTY_ID}] invalid @see targets fail for every prohibited target class`, async (t) => {
  const targetCases = [
    { name: "missing file", kind: "missing" },
    { name: "non-Markdown file", kind: "non-markdown" },
    { name: "untracked Markdown file", kind: "untracked" },
    { name: "outside-repository file", kind: "outside" },
  ];

  for (const targetCase of targetCases) {
    await t.test(`[${PROPERTY_ID}] ${targetCase.name}`, (subtest) => {
      const project = createTemporaryProject(subtest);
      configureSourceScope(project);
      let target = "./missing.md";
      let trackedFilePaths = [];

      if (targetCase.kind === "non-markdown") {
        project.writeFile("src/guide.txt", "Not Markdown\n");
        target = "./guide.txt";
        trackedFilePaths = ["src/guide.txt"];
      }
      if (targetCase.kind === "untracked") {
        project.writeFile("src/guide.md", "# Guide\n");
        target = "./guide.md";
      }
      if (targetCase.kind === "outside") {
        const outsideDirectory = mkdtempSync(join(tmpdir(), "tightscript-outside-"));
        subtest.after(() => rmSync(outsideDirectory, { force: true, recursive: true }));
        const outsideTarget = join(outsideDirectory, "guide.md");
        writeFileSync(outsideTarget, "# Guide\n");
        target = relative(join(project.cwd, "src"), outsideTarget)
          .split(sep)
          .join("/");
      }

      project.writeFile("src/Source.ts", `// @see [guide](${target})\n`);
      initializeGitRepository(project, trackedFilePaths);

      const result = runCli(project.cwd);

      assertFailure(result, "REQ-012");
    });
  }
});

test(`[${PROPERTY_ID}] GitHub heading fragments accept valid anchors and reject unknown duplicate suffixes`, async (t) => {
  const validProject = createTemporaryProject(t);
  configureSourceScope(validProject);
  validProject.writeFile(
    "src/Source.ts",
    "// @see [guide](../docs/guide.md#quick-start)\n" +
      "// @see [guide](../docs/guide.md#duplicate-guide-1)\n",
  );
  validProject.writeFile(
    "docs/guide.md",
    "# Guide\n\n## Quick start\n\n## Duplicate Guide\n\n## Duplicate Guide\n",
  );
  initializeGitRepository(validProject, ["docs/guide.md"]);
  assertPass(runCli(validProject.cwd));

  const invalidFragments = ["not-a-heading", "duplicate-guide-2"];
  for (const fragment of invalidFragments) {
    await t.test(`[${PROPERTY_ID}] rejects #${fragment}`, (subtest) => {
      const project = createTemporaryProject(subtest);
      configureSourceScope(project);
      project.writeFile(
        "src/Source.ts",
        `// @see [guide](../docs/guide.md#${fragment})\n`,
      );
      project.writeFile(
        "docs/guide.md",
        "# Guide\n\n## Duplicate Guide\n\n## Duplicate Guide\n",
      );
      initializeGitRepository(project, ["docs/guide.md"]);

      const result = runCli(project.cwd);

      assertFailure(result, "REQ-013");
    });
  }
});

test(`[${PROPERTY_ID}] suppression comments fail without hiding separate policy violations`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile("src/Suppression.ts", "// @ts-ignore\nlet forbiddenValue = 1;\n");
  initializeGitRepository(project);

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

test(`[${PROPERTY_ID}] @see symlinks are checked using their final targets`, async (t) => {
  const targetCases = [
    {
      name: "tracked Markdown target inside the repository",
      kind: "tracked-inside",
      expectedStatus: 0,
    },
    {
      name: "untracked Markdown final target",
      kind: "untracked-inside",
      expectedStatus: 1,
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
    await t.test(`[${PROPERTY_ID}] ${targetCase.name}`, (subtest) => {
      const project = createTemporaryProject(subtest);
      configureSourceScope(project);
      project.writeFile("src/Source.ts", "// @see [guide](./linked.md)\n");
      let symlinkTarget;
      let trackedFilePaths = [];

      if (targetCase.kind === "tracked-inside") {
        project.writeFile("docs/guide.md", "# Guide\n");
        symlinkTarget = "../docs/guide.md";
        trackedFilePaths = ["docs/guide.md"];
      }
      if (targetCase.kind === "untracked-inside") {
        project.writeFile("docs/guide.md", "# Guide\n");
        symlinkTarget = "../docs/guide.md";
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
        if (!UNSUPPORTED_SYMLINK_ERRORS.has(error.code)) {
          throw error;
        }
        subtest.skip(`Symlink creation is unavailable (${error.code}).`);
        return;
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
      assert.ok(result.stderr.includes("[REQ-012]"), result.stderr);
      assert.ok(result.stderr.endsWith("FAIL\n"), result.stderr);
    });
  }
});
