import assert from "node:assert/strict";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

const PROPERTY_ID = "PROP-REQ-001-01";

function configureSourceScope(project) {
  project.writeFile(
    "tightscript.config.json",
    JSON.stringify({ include: ["src/**/*.ts", "src/**/*.tsx"] }),
  );
}

function assertFailedCheck(result) {
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
}

test(`[${PROPERTY_ID}] a complete clean selection reports PASS`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile("src/Clean.ts", "const cleanValue: number = 1;\n");

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});

test(`[${PROPERTY_ID}] a valid empty selection reports PASS`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});

test(`[${PROPERTY_ID}] a policy violation reports FAIL with a nonzero status`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile("src/Violation.ts", "let forbiddenValue = 1;\n");

  const result = runCli(project.cwd);

  assertFailedCheck(result);
  assert.equal(
    result.stderr,
    "src/Violation.ts:1:1 [REQ-009] `let` declarations are not permitted.\nFAIL\n",
  );
});

test(`[${PROPERTY_ID}] missing, absent, and empty source scopes fail fast`, async (t) => {
  const cases = [
    {
      name: "missing configuration",
      configuration: undefined,
      expectedError: (cwd) =>
        `FAIL: Source-scope configuration error: tightscript.config.json was not found in the current working directory (${cwd}).\n`,
    },
    {
      name: "absent include setting",
      configuration: "{}",
      expectedError: () =>
        'FAIL: Source-scope configuration error: tightscript.config.json must provide a non-empty "include" array.\n',
    },
    {
      name: "empty include setting",
      configuration: JSON.stringify({ include: [] }),
      expectedError: () =>
        'FAIL: Source-scope configuration error: tightscript.config.json must provide a non-empty "include" array.\n',
    },
  ];

  for (const scenario of cases) {
    await t.test(`[${PROPERTY_ID}] ${scenario.name}`, (subtest) => {
      const project = createTemporaryProject(subtest);
      if (scenario.configuration !== undefined) {
        project.writeFile("tightscript.config.json", scenario.configuration);
      }

      const result = runCli(project.cwd);

      assertFailedCheck(result);
      assert.equal(result.stderr, scenario.expectedError(project.cwd));
    });
  }
});

test(`[${PROPERTY_ID}] selected-file parse failures fail closed`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile("src/Broken.ts", "const brokenValue = ;\n");

  const result = runCli(project.cwd);

  assertFailedCheck(result);
  assert.match(
    result.stderr,
    /src\/Broken\.ts:1:\d+ \[REQ-005\] Evaluation error:/,
  );
  assert.match(result.stderr, /\nFAIL\n$/);
});

test(`[${PROPERTY_ID}] malformed compiler configuration fails closed`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile("src/Clean.ts", "const cleanValue = 1;\n");
  project.writeFile("tsconfig.json", '{"compilerOptions": {\n');

  const result = runCli(project.cwd);

  assertFailedCheck(result);
  assert.match(
    result.stderr,
    /tsconfig\.json(?::\d+:\d+)? \[REQ-005\] Evaluation error:/,
  );
  assert.match(result.stderr, /\nFAIL\n$/);
});

test(`[${PROPERTY_ID}] unresolved REQ-024 heritage information fails closed`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/Unresolved.ts",
    "export interface Unresolved extends MissingBase {}\n",
  );

  const result = runCli(project.cwd);

  assertFailedCheck(result);
  assert.equal(
    result.stderr,
    "src/Unresolved.ts:1:37 [REQ-005] Evaluation error: Could not resolve interface heritage required by REQ-024.\nFAIL\n",
  );
});

test(`[${PROPERTY_ID}] unrelated TypeScript type errors do not fail complete policy evaluation`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile("src/TypeError.ts", "const textValue: string = 123;\n");

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});
