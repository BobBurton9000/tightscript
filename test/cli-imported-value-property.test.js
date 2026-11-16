import assert from "node:assert/strict";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

const PROPERTY_ID = "PROP-REQ-019-01";

function configureProject(project) {
  project.writeFile("package.json", JSON.stringify({ type: "module" }));
  project.writeFile(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        skipLibCheck: true,
      },
    }),
  );
  project.writeFile(
    "tightscript.config.json",
    JSON.stringify({ include: ["src/**/*.ts"] }),
  );
}

function runConfiguredProject(project) {
  const result = runCli(project.cwd);
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

function requirementDiagnostics(result, requirementId) {
  return result.stderr
    .split("\n")
    .filter((line) => line.includes(`[${requirementId}]`));
}

function assertFailedCheck(result) {
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /\nFAIL\n$/);
}

test(`[${PROPERTY_ID}] direct imported values and local aliases used only for export are reported`, (t) => {
  const project = createTemporaryProject(t);
  configureProject(project);
  project.writeFile(
    "support/dependency.ts",
    "export const directValue = 1;\n" +
      "export const aliasedValue = 2;\n",
  );
  project.writeFile(
    "src/pass-throughs.ts",
    'import { directValue, aliasedValue } from "../support/dependency.js";\n' +
      "const localAlias = aliasedValue;\n" +
      "export const directOutput = directValue;\n" +
      "export const aliasOutput = localAlias;\n",
  );

  const result = runConfiguredProject(project);

  assertFailedCheck(result);
  assert.deepEqual(
    requirementDiagnostics(result, "REQ-019").map((line) =>
      line.match(/Imported value "([^"]+)"/)[1],
    ),
    ["directValue", "aliasedValue"],
  );
});

test(`[${PROPERTY_ID}] nested wrappers report imports despite aliases, renamed properties, and spreads`, (t) => {
  const project = createTemporaryProject(t);
  configureProject(project);
  project.writeFile(
    "support/dependency.ts",
    "export const firstValue = { first: true };\n" +
      "export const secondValue = { second: true };\n" +
      "export const thirdValue = { third: true };\n",
  );
  project.writeFile(
    "src/nested-wrapper.ts",
    'import { firstValue, secondValue, thirdValue } from "../support/dependency.js";\n' +
      "const aliasedSecondValue = secondValue;\n" +
      "export const output = {\n" +
      "  renamedFirst: firstValue,\n" +
      "  nested: { ...aliasedSecondValue, renamedThird: thirdValue },\n" +
      "};\n",
  );

  const result = runConfiguredProject(project);

  assertFailedCheck(result);
  assert.deepEqual(
    requirementDiagnostics(result, "REQ-019").map((line) =>
      line.match(/Imported value "([^"]+)"/)[1],
    ),
    ["firstValue", "secondValue", "thirdValue"],
  );
});

test(`[${PROPERTY_ID}] added behavior and extra import uses are not passthroughs`, (t) => {
  const project = createTemporaryProject(t);
  configureProject(project);
  project.writeFile(
    "support/dependency.ts",
    "export const computedInput = { value: 1 };\n" +
      "export const calledInput = { value: 2 };\n" +
      "export const methodInput = { value: 3 };\n" +
      "export const accessorInput = { value: 4 };\n" +
      "export const extraUseInput = { value: 5 };\n",
  );
  project.writeFile(
    "src/controls.ts",
    'import { computedInput, calledInput, methodInput, accessorInput, extraUseInput } from "../support/dependency.js";\n' +
      "function transform(value: unknown): unknown { return value; }\n" +
      "export const computed = { original: computedInput, added: computedInput.value };\n" +
      "export const called = { original: calledInput, added: transform(calledInput) };\n" +
      "export const method = { original: methodInput, added() { return methodInput; } };\n" +
      "export const accessor = { original: accessorInput, get added() { return accessorInput; } };\n" +
      "export const extraUse = { original: extraUseInput };\n" +
      "console.log(extraUseInput);\n",
  );

  const result = runConfiguredProject(project);

  assertFailedCheck(result);
  assert.deepEqual(requirementDiagnostics(result, "REQ-019"), []);
  assert.equal(requirementDiagnostics(result, "REQ-021").length, 5);
});

test(`[${PROPERTY_ID}] type-only and namespace source re-exports remain exempt`, (t) => {
  const project = createTemporaryProject(t);
  configureProject(project);
  project.writeFile(
    "support/source.ts",
    "export const sourceValue = 1;\n" +
      "export interface SourceType {}\n",
  );
  project.writeFile(
    "src/reexports.ts",
    'export type { SourceType } from "../support/source.js";\n' +
      'export * as sourceNamespace from "../support/source.js";\n',
  );

  const result = runConfiguredProject(project);

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});

test(`[${PROPERTY_ID}] unresolved imported symbols fail the real CLI closed`, (t) => {
  const project = createTemporaryProject(t);
  configureProject(project);
  project.writeFile(
    "src/unresolved.ts",
    'import { unavailable } from "../support/missing.js";\n' +
      "export const passthrough = unavailable;\n",
  );

  const result = runConfiguredProject(project);

  assertFailedCheck(result);
  assert.match(result.stderr, /\[REQ-005\] Evaluation error:/);
  assert.match(result.stderr, /\nFAIL\n$/);
});
