import assert from "node:assert/strict";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

const PROPERTY_ID = "PROP-REQ-024-01";

function configureSourceScope(project) {
  project.writeFile(
    "tightscript.config.json",
    JSON.stringify({ include: ["src/**/*.ts"] }),
  );
}

function assertFailedCheck(result) {
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
}

test(`[${PROPERTY_ID}] data, index, and function-valued properties produce REQ-024 diagnostics`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/DataProperty.ts",
    "interface DataProperty {\n  value: string;\n}\n",
  );
  project.writeFile(
    "src/FunctionProperty.ts",
    "interface FunctionProperty {\n  handler: () => void;\n}\n",
  );
  project.writeFile(
    "src/IndexSignature.ts",
    "interface IndexSignature {\n  [key: string]: unknown;\n}\n",
  );
  project.writeFile(
    "src/MethodOnly.ts",
    "interface MethodOnly {\n  execute(value: string): void;\n}\n",
  );

  const result = runCli(project.cwd);

  assertFailedCheck(result);
  assert.equal(
    result.stderr,
    'src/DataProperty.ts:2:3 [REQ-024] Interface data property "value" is not permitted; interfaces may declare methods only.\n' +
      'src/FunctionProperty.ts:2:3 [REQ-024] Interface data property "handler" is not permitted; interfaces may declare methods only.\n' +
      "src/IndexSignature.ts:2:3 [REQ-024] Interface index signatures are not permitted.\n" +
      "FAIL\n",
  );
});

test(`[${PROPERTY_ID}] direct and inherited call and construct signatures fail through branched graphs`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" },
    }),
  );
  project.writeFile(
    "src/DirectCall.ts",
    "interface DirectCall {\n  (value: string): number;\n}\n",
  );
  project.writeFile(
    "src/DirectConstruct.ts",
    "interface DirectConstruct {\n  new (value: string): object;\n}\n",
  );
  project.writeFile(
    "src/CallBase.ts",
    "export interface CallBase {\n  (): void;\n}\n",
  );
  project.writeFile(
    "src/CallChild.ts",
    'import type { CallBase } from "./CallBase.js";\n' +
      "export interface CallChild extends CallBase {}\n",
  );
  project.writeFile(
    "src/CallGrandchild.ts",
    'import type { CallChild } from "./CallChild.js";\n' +
      "export interface CallGrandchild extends CallChild {}\n",
  );
  project.writeFile(
    "src/ConstructBase.ts",
    "export interface ConstructBase {\n  new (): object;\n}\n",
  );
  project.writeFile(
    "src/ConstructChild.ts",
    'import type { ConstructBase } from "./ConstructBase.js";\n' +
      "export interface ConstructChild extends ConstructBase {}\n",
  );
  project.writeFile(
    "src/ConstructGrandchild.ts",
    'import type { ConstructChild } from "./ConstructChild.js";\n' +
      "export interface ConstructGrandchild extends ConstructChild {}\n",
  );
  project.writeFile(
    "src/Branched.ts",
    'import type { CallChild } from "./CallChild.js";\n' +
      'import type { ConstructChild } from "./ConstructChild.js";\n' +
      "export interface Branched extends CallChild, ConstructChild {}\n",
  );

  const result = runCli(project.cwd);

  assertFailedCheck(result);
  const findings = result.stderr
    .split("\n")
    .filter((line) => line.includes("[REQ-024]"))
    .map((line) => line.replace(/:\d+:\d+ /, " "));
  assert.deepEqual(findings, [
    'src/Branched.ts [REQ-024] Interface "Branched" must not inherit call signatures.',
    'src/Branched.ts [REQ-024] Interface "Branched" must not inherit construct signatures.',
    "src/CallBase.ts [REQ-024] Interface call signatures are not permitted.",
    'src/CallChild.ts [REQ-024] Interface "CallChild" must not inherit call signatures.',
    'src/CallGrandchild.ts [REQ-024] Interface "CallGrandchild" must not inherit call signatures.',
    "src/ConstructBase.ts [REQ-024] Interface construct signatures are not permitted.",
    'src/ConstructChild.ts [REQ-024] Interface "ConstructChild" must not inherit construct signatures.',
    'src/ConstructGrandchild.ts [REQ-024] Interface "ConstructGrandchild" must not inherit construct signatures.',
    "src/DirectCall.ts [REQ-024] Interface call signatures are not permitted.",
    "src/DirectConstruct.ts [REQ-024] Interface construct signatures are not permitted.",
  ]);
  assert.match(result.stderr, /\nFAIL\n$/);
});

test(`[${PROPERTY_ID}] explicit CallableFunction heritage produces REQ-026`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/Callable.ts",
    "interface Callable extends CallableFunction {}\n",
  );

  const result = runCli(project.cwd);

  assertFailedCheck(result);
  assert.equal(
    result.stderr,
    "src/Callable.ts:1:28 [REQ-026] Interfaces must not extend CallableFunction.\nFAIL\n",
  );
});

test(`[${PROPERTY_ID}] method-only interfaces pass as a control`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/MethodOnly.ts",
    "interface MethodOnly {\n  execute(value: string): void;\n}\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});

test(`[${PROPERTY_ID}] unresolved required heritage fails closed`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/Unresolved.ts",
    "interface Unresolved extends MissingBase {}\n",
  );

  const result = runCli(project.cwd);

  assertFailedCheck(result);
  assert.equal(
    result.stderr,
    "src/Unresolved.ts:1:30 [REQ-005] Evaluation error: Could not resolve interface heritage required by REQ-024.\nFAIL\n",
  );
});
