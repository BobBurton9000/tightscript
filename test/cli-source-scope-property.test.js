import assert from "node:assert/strict";
import { symlinkSync } from "node:fs";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

const PROPERTY_ID = "PROP-REQ-006-01";
const UNSUPPORTED_SYMLINK_ERRORS = new Set([
  "EACCES",
  "ENOSYS",
  "ENOTSUP",
  "EOPNOTSUPP",
  "EPERM",
]);

function configureSourceScope(project, cwd, patterns) {
  project.writeFile(
    `${cwd}/tightscript.config.json`,
    JSON.stringify({ include: patterns }),
  );
}

function diagnosticPaths(result) {
  return result.stderr
    .split("\n")
    .filter((line) => /^\S+:\d+:\d+ \[REQ-\d{3}\] /u.test(line))
    .map((line) => {
      const match = line.match(/^(.*):\d+:\d+ \[(REQ-\d{3})\] /u);
      assert.ok(match, `Expected a located diagnostic: ${line}`);
      return { filePath: match[1], requirementId: match[2] };
    });
}

function assertFailedCheck(result) {
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /\nFAIL\n$/u);
}

function createDirectorySymlink(testContext, target, linkPath) {
  try {
    symlinkSync(target, linkPath, "dir");
    return true;
  } catch (error) {
    if (!UNSUPPORTED_SYMLINK_ERRORS.has(error.code)) {
      throw error;
    }
    testContext.skip(`Directory symlink creation is unavailable (${error.code}).`);
    return false;
  }
}

test(`[${PROPERTY_ID}] include patterns are relative to each invocation CWD and inspect every matching .ts and .tsx file`, (t) => {
  const project = createTemporaryProject(t);
  const patterns = ["src/**/*.ts", "src/**/*.tsx"];
  configureSourceScope(project, ".", patterns);
  configureSourceScope(project, "nested", patterns);

  project.writeFile("src/Root.ts", "let rootValue = 1;\n");
  project.writeFile("src/nested/Child.tsx", "if (true) {} else {}\n");
  project.writeFile("other/RootControl.ts", "let rootControl = 1;\n");
  project.writeFile("nested/src/Nested.tsx", "let nestedValue = 1;\n");
  project.writeFile("nested/src/deep/Leaf.ts", "if (true) {} else {}\n");
  project.writeFile("nested/other/NestedControl.ts", "let nestedControl = 1;\n");

  const rootResult = runCli(project.cwd);
  assertFailedCheck(rootResult);
  assert.deepEqual(diagnosticPaths(rootResult), [
    { filePath: "src/Root.ts", requirementId: "REQ-009" },
    { filePath: "src/nested/Child.tsx", requirementId: "REQ-032" },
  ]);

  const nestedResult = runCli(`${project.cwd}/nested`);
  assertFailedCheck(nestedResult);
  assert.deepEqual(diagnosticPaths(nestedResult), [
    { filePath: "src/Nested.tsx", requirementId: "REQ-009" },
    { filePath: "src/deep/Leaf.ts", requirementId: "REQ-032" },
  ]);
});

test(`[${PROPERTY_ID}] matching aliases for one physical file report the first sorted path`, (t) => {
  const project = createTemporaryProject(t);
  const physicalDirectory = `${project.cwd}/physical`;
  project.writeFile("physical/Shared.ts", "let sharedValue = 1;\n");
  configureSourceScope(project, ".", ["z-alias/**/*.ts", "a-alias/**/*.ts"]);

  if (
    !createDirectorySymlink(
      t,
      physicalDirectory,
      `${project.cwd}/z-alias`,
    ) ||
    !createDirectorySymlink(
      t,
      physicalDirectory,
      `${project.cwd}/a-alias`,
    )
  ) {
    return;
  }

  const result = runCli(project.cwd);

  assertFailedCheck(result);
  assert.equal(
    result.stderr,
    "a-alias/Shared.ts:1:1 [REQ-009] `let` declarations are not permitted.\nFAIL\n",
  );
});
