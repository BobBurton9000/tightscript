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

test("CLI rejects REQ-024 interface data properties and index signatures but allows methods", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/DataProperty.ts",
    "interface DataProperty {\n  value?: string;\n}\n",
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

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    'src/DataProperty.ts:2:3 [REQ-024] Interface data property "value" is not permitted; interfaces may declare methods only.\n' +
      'src/FunctionProperty.ts:2:3 [REQ-024] Interface data property "handler" is not permitted; interfaces may declare methods only.\n' +
      "src/IndexSignature.ts:2:3 [REQ-024] Interface index signatures are not permitted.\n" +
      "FAIL\n",
  );
});

test("CLI rejects REQ-024 direct call and construct signatures while allowing method-only interfaces", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/DirectCall.ts",
    "interface DirectCall {\n  (value: string): number;\n}\n",
  );
  project.writeFile(
    "src/DirectConstruct.ts",
    "interface DirectConstruct {\n  new (value: string): object;\n}\n",
  );
  project.writeFile(
    "src/MethodControl.ts",
    "interface MethodControl {\n  execute(value: string): void;\n}\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "src/DirectCall.ts:2:3 [REQ-024] Interface call signatures are not permitted.\n" +
      "src/DirectConstruct.ts:2:3 [REQ-024] Interface construct signatures are not permitted.\n" +
      "FAIL\n",
  );
});

test("CLI rejects REQ-024 call and construct signatures inherited directly and transitively", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" },
    }),
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

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const findings = result.stderr.split("\n").filter((line) => line.includes("[REQ-024]"));
  assert.deepEqual(
    findings.map((line) => line.replace(/:\d+:\d+ /, " ")),
    [
      "src/Branched.ts [REQ-024] Interface \"Branched\" must not inherit call signatures.",
      "src/Branched.ts [REQ-024] Interface \"Branched\" must not inherit construct signatures.",
      "src/CallBase.ts [REQ-024] Interface call signatures are not permitted.",
      "src/CallChild.ts [REQ-024] Interface \"CallChild\" must not inherit call signatures.",
      "src/CallGrandchild.ts [REQ-024] Interface \"CallGrandchild\" must not inherit call signatures.",
      "src/ConstructBase.ts [REQ-024] Interface construct signatures are not permitted.",
      "src/ConstructChild.ts [REQ-024] Interface \"ConstructChild\" must not inherit construct signatures.",
      "src/ConstructGrandchild.ts [REQ-024] Interface \"ConstructGrandchild\" must not inherit construct signatures.",
    ],
  );
  assert.match(result.stderr, /src\/CallChild\.ts:2:\d+ \[REQ-024\]/);
  assert.match(result.stderr, /src\/CallGrandchild\.ts:2:\d+ \[REQ-024\]/);
  assert.match(result.stderr, /src\/ConstructChild\.ts:2:\d+ \[REQ-024\]/);
  assert.match(result.stderr, /src\/ConstructGrandchild\.ts:2:\d+ \[REQ-024\]/);
  assert.match(result.stderr, /\nFAIL\n$/);
});

test("CLI rejects REQ-026 explicit CallableFunction heritage", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/ExplicitCallable.ts",
    "export interface ExplicitCallable extends CallableFunction {}\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "src/ExplicitCallable.ts:1:43 [REQ-026] Interfaces must not extend CallableFunction.\nFAIL\n",
  );
});

test("CLI fails closed when REQ-024 interface heritage cannot be resolved", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/Unresolved.ts",
    "export interface Unresolved extends MissingBase {}\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "src/Unresolved.ts:1:37 [REQ-005] Evaluation error: Could not resolve interface heritage required by REQ-024.\nFAIL\n",
  );
});
