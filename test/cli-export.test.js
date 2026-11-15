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

test("CLI rejects separate local value export lists but exempts type-only exports and source re-exports [REQ-020]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/LocalType.ts",
    "const localValue = 1;\n" +
      "function localFunction() {}\n" +
      "interface LocalType {}\n" +
      "export { localValue, localFunction, LocalType };\n" +
      'export { remoteValue } from "./remote.js";\n',
  );
  project.writeFile(
    "src/LocalClass.ts",
    "class LocalClass {}\nexport { LocalClass };\n",
  );
  project.writeFile(
    "src/LocalObject.ts",
    "const publicObject = {};\nexport { publicObject };\n",
  );
  project.writeFile("src/remote.ts", "export const remoteValue = 1;\n");

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    'src/LocalClass.ts:2:10 [REQ-020] Local value "LocalClass" must be exported inline instead of through a separate export list.\n' +
      'src/LocalObject.ts:2:10 [REQ-020] Local value "publicObject" must be exported inline instead of through a separate export list.\n' +
      'src/LocalObject.ts:2:10 [REQ-021] Exported const "publicObject" must not expose an object literal.\n' +
      'src/LocalType.ts:4:10 [REQ-020] Local value "localValue" must be exported inline instead of through a separate export list.\n' +
      'src/LocalType.ts:4:22 [REQ-018] Exported value "localFunction" must not be callable.\n' +
      'src/LocalType.ts:4:22 [REQ-020] Local value "localFunction" must be exported inline instead of through a separate export list.\n' +
      "FAIL\n",
  );
});

test("CLI rejects direct callable exports and callable values [REQ-018]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/direct.ts",
    "export function directFunction() {}\n" +
      "export const callableValue: () => void = () => {};\n" +
      "export const nonCallable = 1;\n" +
      "export default function defaultCallable() {}\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    'src/direct.ts:1:17 [REQ-018] Exported value "directFunction" must not be callable.\n' +
      'src/direct.ts:2:14 [REQ-018] Exported value "callableValue" must not be callable.\n' +
      'src/direct.ts:4:25 [REQ-018] Exported value "default" must not be callable.\n' +
      "FAIL\n",
  );
});

test("CLI rejects callable named re-exports and export-star values but skips type-only exports [REQ-018]", (t) => {
  const project = createTemporaryProject(t);
  project.writeFile(
    "tightscript.config.json",
    JSON.stringify({ include: ["src/index.ts"] }),
  );
  project.writeFile(
    "src/index.ts",
    'export { namedCallable as renamedCallable } from "../support/named.js";\n' +
      'export * from "../support/star.js";\n' +
      'export type { typeOnlyCallable } from "../support/type-only.js";\n',
  );
  project.writeFile(
    "support/named.ts",
    "export function namedCallable() {}\n",
  );
  project.writeFile(
    "support/star.ts",
    "export const starCallable = () => {};\n" +
      "export default function defaultCallable() {}\n" +
      "export const ordinaryValue = 1;\n",
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
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    'src/index.ts:1:10 [REQ-018] Exported value "renamedCallable" must not be callable.\n' +
      'src/index.ts:2:1 [REQ-018] Exported value "starCallable" must not be callable.\n' +
      "FAIL\n",
  );
});

test("CLI fails closed when REQ-018 callable export information is unresolved", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/unresolved.ts",
    "export const unknownCallable = missingFactory();\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "src/unresolved.ts:1:14 [REQ-005] Evaluation error: Could not resolve callable export information required by REQ-018.\nFAIL\n",
  );
});

test("CLI rejects object-like named exports, default targets, and direct default exports [REQ-021]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  const cases = [
    {
      file: "default-direct-freeze.ts",
      source: "export default Object.freeze({});\n",
      diagnostic:
        "src/default-direct-freeze.ts:1:16 [REQ-021] Default export must not expose an Object.freeze object literal.",
    },
    {
      file: "default-direct-instance.ts",
      source: "class Example {}\nexport default new Example();\n",
      diagnostic:
        "src/default-direct-instance.ts:2:16 [REQ-021] Default export must not expose a class instance.",
    },
    {
      file: "default-direct-object.ts",
      source: "export default {};\n",
      diagnostic:
        "src/default-direct-object.ts:1:16 [REQ-021] Default export must not expose an object literal.",
    },
    {
      file: "default-target-freeze.ts",
      source: "const value = Object.freeze({});\nexport default value;\n",
      diagnostic:
        'src/default-target-freeze.ts:2:16 [REQ-021] Exported const "value" must not expose an Object.freeze object literal.',
    },
    {
      file: "default-target-instance.ts",
      source:
        "class Example {}\nconst value = new Example();\nexport default value;\n",
      diagnostic:
        'src/default-target-instance.ts:3:16 [REQ-021] Exported const "value" must not expose a class instance.',
    },
    {
      file: "default-target-object.ts",
      source: "const value = {};\nexport default value;\n",
      diagnostic:
        'src/default-target-object.ts:2:16 [REQ-021] Exported const "value" must not expose an object literal.',
    },
    {
      file: "named-freeze.ts",
      source: "export const value = Object.freeze({});\n",
      diagnostic:
        'src/named-freeze.ts:1:14 [REQ-021] Exported const "value" must not expose an Object.freeze object literal.',
    },
    {
      file: "named-instance.ts",
      source: "class Example {}\nexport const value = new Example();\n",
      diagnostic:
        'src/named-instance.ts:2:14 [REQ-021] Exported const "value" must not expose a class instance.',
    },
    {
      file: "named-object.ts",
      source: "export const value = {};\n",
      diagnostic:
        'src/named-object.ts:1:14 [REQ-021] Exported const "value" must not expose an object literal.',
    },
  ];

  for (const testCase of cases) {
    project.writeFile(`src/${testCase.file}`, testCase.source);
  }
  project.writeFile(
    "src/clean-controls.ts",
    "const hiddenObject = {};\n" +
      "export const primitive = 1;\n" +
      "export default primitive;\n" +
      "export const frozenAlias = Object.freeze(hiddenObject);\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    `${cases.map(({ diagnostic }) => diagnostic).join("\n")}\nFAIL\n`,
  );
});
