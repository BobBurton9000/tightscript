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

test("CLI passes a complete check with an empty source selection [REQ-001, REQ-002]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});

test("CLI passes a complete check with selected clean source files [REQ-001, REQ-002]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile("src/clean.ts", "const selectedValue = 1;\n");
  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});

test("CLI reports sorted REQ-009 findings with source locations and fails [REQ-001, REQ-003, REQ-004]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile("src/zeta.ts", "let laterFile = 1;\n");
  project.writeFile("src/alpha.ts", "let firstFinding = 1;\nlet secondFinding = 2;\n");
  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "src/alpha.ts:1:1 [REQ-009] `let` declarations are not permitted.\n" +
      "src/alpha.ts:2:1 [REQ-009] `let` declarations are not permitted.\n" +
      "src/zeta.ts:1:1 [REQ-009] `let` declarations are not permitted.\n" +
      "FAIL\n",
  );
});

test("CLI fails closed with a located REQ-005 diagnostic for selected-file parse errors [REQ-001, REQ-005]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile("src/broken.ts", "const brokenValue = ;\n");
  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /src\/broken\.ts:1:\d+ \[REQ-005\] Evaluation error:/);
  assert.match(result.stderr, /\nFAIL\n$/);
});
