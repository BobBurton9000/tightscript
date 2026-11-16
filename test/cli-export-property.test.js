import assert from "node:assert/strict";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

const PROPERTY_ID = "PROP-REQ-018-01";

function configureSourceScope(project, include = ["src/**/*.ts"]) {
  project.writeFile(
    "tightscript.config.json",
    JSON.stringify({ include }),
  );
}

function assertFailedCheck(result) {
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
}

test(`[${PROPERTY_ID}] direct callable exports produce REQ-018 diagnostics`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/direct.ts",
    "export function directFunction() {}\n" +
      "export const callableValue: () => void = () => {};\n" +
      "export default function defaultCallable() {}\n",
  );

  const result = runCli(project.cwd);

  assertFailedCheck(result);
  assert.equal(
    result.stderr,
    'src/direct.ts:1:17 [REQ-018] Exported value "directFunction" must not be callable.\n' +
      'src/direct.ts:2:14 [REQ-018] Exported value "callableValue" must not be callable.\n' +
      'src/direct.ts:3:25 [REQ-018] Exported value "default" must not be callable.\n' +
      "FAIL\n",
  );
});

test(`[${PROPERTY_ID}] direct non-callable exports do not produce REQ-018 diagnostics`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/ordinary-values.ts",
    "export const numericValue = 1;\n" +
      'export const textValue = "ordinary";\n',
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});

test(`[${PROPERTY_ID}] named and star callable re-exports produce REQ-018 diagnostics`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project, ["src/index.ts"]);
  project.writeFile(
    "src/index.ts",
    'export { namedCallable as renamedCallable } from "../support/named.js";\n' +
      'export * from "../support/star.js";\n',
  );
  project.writeFile(
    "support/named.ts",
    "export function namedCallable() {}\n",
  );
  project.writeFile(
    "support/star.ts",
    "export const starCallable = () => {};\n" +
      "export default function defaultCallable() {}\n",
  );
  project.writeFile(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" },
    }),
  );

  const result = runCli(project.cwd);

  assertFailedCheck(result);
  assert.equal(
    result.stderr,
    'src/index.ts:1:10 [REQ-018] Exported value "renamedCallable" must not be callable.\n' +
      'src/index.ts:1:10 [REQ-019] Source re-export "renamedCallable" must not pass an imported value through unchanged.\n' +
      'src/index.ts:2:1 [REQ-018] Exported value "starCallable" must not be callable.\n' +
      'src/index.ts:2:1 [REQ-019] Source star export "starCallable" must not pass an imported value through unchanged.\n' +
      "FAIL\n",
  );
});

test(`[${PROPERTY_ID}] type-only exports of callable declarations remain permitted`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project, ["src/index.ts"]);
  project.writeFile(
    "src/index.ts",
    'export type { typeOnlyCallable } from "../support/type-only.js";\n',
  );
  project.writeFile(
    "support/type-only.ts",
    "export function typeOnlyCallable() {}\n",
  );
  project.writeFile(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext" },
    }),
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});

test(`[${PROPERTY_ID}] unresolved callable export information fails closed`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/unresolved.ts",
    "export const unknownCallable = missingFactory();\n",
  );

  const result = runCli(project.cwd);

  assertFailedCheck(result);
  assert.equal(
    result.stderr,
    "src/unresolved.ts:1:14 [REQ-005] Evaluation error: Could not resolve callable export information required by REQ-018.\nFAIL\n",
  );
});
