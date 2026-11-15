import assert from "node:assert/strict";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

function configureSourceScope(project) {
  project.writeFile(
    "tightscript.config.json",
    JSON.stringify({ include: ["src/**/*.ts", "src/**/*.tsx"] }),
  );
}

test("CLI accepts the exact @see Markdown-link form in TypeScript comment forms [REQ-010]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/CommentForms.ts",
    "// @see [the guide](./guide.md)\n" +
      "const lineComment = 1;\n" +
      "/* @see [the guide](./guide.md) */\n" +
      "const blockComment = 2;\n" +
      "/**\n" +
      " * @see [the guide](./guide.md)\n" +
      " */\n" +
      "const documentationComment = 3;\n",
  );

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
    "// explanatory prose\n" +
      "// @see [the guide](./guide.md) with extra prose\n" +
      "/* @see [first](./first.md) @see [second](./second.md) */\n" +
      "/** @see [the guide](./guide.md) [another](./other.md) */\n",
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
  assert.match(result.stderr, /\nFAIL\n$/);
});

test("CLI does not treat strings that resemble comments as comments [REQ-010]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/CommentLookingStrings.ts",
    'const lineCommentText = "// explanatory prose";\n' +
      'const blockCommentText = "/* @see [fake](./fake.md) */";\n' +
      'const templateCommentText = `// not a comment`;\n',
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
  project.writeFile(
    "src/Suppression.ts",
    "// @ts-ignore\nlet forbidden = 1;\n",
  );

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
