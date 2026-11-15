import assert from "node:assert/strict";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

test("CLI rejects REQ-019 imported-value passthroughs and allows non-qualifying uses", (t) => {
  const project = createTemporaryProject(t);
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
  project.writeFile(
    "support/dependency.ts",
    "export const directValue = 1;\n" +
      "export const aliasSource = 2;\n" +
      "export const firstValue = 3;\n" +
      "export const secondValue = 4;\n" +
      "export const shorthandValue = 13;\n" +
      "export const computedInput = 5;\n" +
      "export const callInput = 6;\n" +
      "export const methodInput = 7;\n" +
      "export const accessorInput = 8;\n" +
      "export const extraInput = 9;\n" +
      "export const extraAliasInput = 10;\n" +
      "export default 11;\n",
  );
  project.writeFile(
    "support/source.ts",
    "export const sourceValue = 11;\n",
  );
  project.writeFile(
    "support/star.ts",
    "export const starValue = 12;\n" +
      "export interface StarType {}\n",
  );
  project.writeFile("support/types.ts", "export interface SourceType {}\n");
  project.writeFile(
    "src/default-import.ts",
    'import defaultValue from "../support/dependency.js";\n' +
      "export default defaultValue;\n",
  );
  project.writeFile(
    "src/direct.ts",
    'import { directValue } from "../support/dependency.js";\n' +
      "export { directValue };\n",
  );
  project.writeFile(
    "src/namespace-import.ts",
    'import * as importedNamespace from "../support/dependency.js";\n' +
      "export { importedNamespace };\n",
  );
  project.writeFile(
    "src/import-equals.ts",
    'import dependency = require("../support/dependency.js");\n' +
      "export { dependency };\n",
  );
  project.writeFile(
    "src/alias.ts",
    'import { aliasSource } from "../support/dependency.js";\n' +
      "const localAlias = aliasSource;\n" +
      "export { localAlias as publicValue };\n",
  );
  project.writeFile(
    "src/nested-wrapper.ts",
    'import { firstValue, secondValue, shorthandValue } from "../support/dependency.js";\n' +
      "const nestedAlias = secondValue;\n" +
      "export const exportedWrapper = {\n" +
      "  renamed: firstValue,\n" +
      "  nested: { ...nestedAlias, shorthandValue },\n" +
      "};\n",
  );
  project.writeFile(
    "src/source-reexport.ts",
    'export { sourceValue as renamedSourceValue } from "../support/source.js";\n',
  );
  project.writeFile(
    "src/star-reexport.ts",
    'export * from "../support/star.js";\n',
  );
  project.writeFile(
    "src/controls.ts",
    'import { computedInput, callInput, methodInput, accessorInput, extraInput, extraAliasInput } from "../support/dependency.js";\n' +
      "export const computedResult = computedInput + 1;\n" +
      "function decorate(value: number): number { return value + 1; }\n" +
      "export const calledResult = decorate(callInput);\n" +
      "export const methodWrapper = { method() { return methodInput; } };\n" +
      "export const accessorWrapper = { get value() { return accessorInput; } };\n" +
      "export { extraInput };\n" +
      "console.log(extraInput);\n" +
      "const extraAlias = extraAliasInput;\n" +
      "export { extraAlias };\n" +
      "console.log(extraAlias);\n",
  );
  project.writeFile(
    "src/source-controls.ts",
    'export type { SourceType } from "../support/types.js";\n' +
      'export * as dependencyNamespace from "../support/source.js";\n',
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const importedValueDiagnostics = result.stderr
    .split("\n")
    .filter((line) => line.includes("[REQ-019]"));
  assert.deepEqual(importedValueDiagnostics, [
    'src/alias.ts:1:10 [REQ-019] Imported value "aliasSource" must not be re-exported unchanged or through an export-only wrapper.',
    'src/default-import.ts:1:8 [REQ-019] Imported value "defaultValue" must not be re-exported unchanged or through an export-only wrapper.',
    'src/direct.ts:1:10 [REQ-019] Imported value "directValue" must not be re-exported unchanged or through an export-only wrapper.',
    'src/import-equals.ts:1:8 [REQ-019] Imported value "dependency" must not be re-exported unchanged or through an export-only wrapper.',
    'src/namespace-import.ts:1:13 [REQ-019] Imported value "importedNamespace" must not be re-exported unchanged or through an export-only wrapper.',
    'src/nested-wrapper.ts:1:10 [REQ-019] Imported value "firstValue" must not be re-exported unchanged or through an export-only wrapper.',
    'src/nested-wrapper.ts:1:22 [REQ-019] Imported value "secondValue" must not be re-exported unchanged or through an export-only wrapper.',
    'src/nested-wrapper.ts:1:35 [REQ-019] Imported value "shorthandValue" must not be re-exported unchanged or through an export-only wrapper.',
    'src/source-reexport.ts:1:10 [REQ-019] Source re-export "renamedSourceValue" must not pass an imported value through unchanged.',
    'src/star-reexport.ts:1:1 [REQ-019] Source star export "starValue" must not pass an imported value through unchanged.',
  ]);
  assert.match(
    result.stderr,
    /src\/nested-wrapper\.ts:3:14 \[REQ-021\] Exported const "exportedWrapper" must not expose an object literal\./,
  );
  assert.match(result.stderr, /\nFAIL\n$/);
  assert.doesNotMatch(result.stderr, /src\/controls\.ts:\d+:\d+ \[REQ-019\]/);
  assert.doesNotMatch(result.stderr, /src\/source-controls\.ts:\d+:\d+ \[REQ-019\]/);
});
