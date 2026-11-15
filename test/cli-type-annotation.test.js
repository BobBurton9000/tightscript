import assert from "node:assert/strict";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

function configureSourceScope(project) {
  project.writeFile(
    "tightscript.config.json",
    JSON.stringify({ include: ["src/**/*.ts"] }),
  );
}

test("CLI rejects anonymous function parameter and return object types [REQ-027]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/FunctionDeclarations.ts",
    "interface NamedValue { value(): string; }\n" +
      "function namedTypeControl(value: NamedValue): NamedValue { return value; }\n" +
      "function declarationParameter(value: { input: string }): void {}\n" +
      "function declarationReturn(): { output: string } {\n" +
      '  return { output: "result" };\n' +
      "}\n" +
      "const typedFunction: (value: { input: string }) => { output: string } = (\n" +
      "  value,\n" +
      ") => ({ output: value.input });\n" +
      "const arrowFunction = (value: { input: string }): { output: string } => ({\n" +
      "  output: value.input,\n" +
      "});\n",
  );
  project.writeFile(
    "src/FunctionSignature.ts",
    "interface FunctionSignature {\n" +
      "  transform(value: { input: string }): { output: string };\n" +
      "}\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const findings = result.stderr
    .split("\n")
    .filter((line) => line.includes("[REQ-027]"));
  assert.equal(findings.length, 8, result.stderr);
  assert.deepEqual(findings, [
    "src/FunctionDeclarations.ts:3:38 [REQ-027] Function parameter and return annotations must use named object types instead of anonymous object type literals.",
    "src/FunctionDeclarations.ts:4:31 [REQ-027] Function parameter and return annotations must use named object types instead of anonymous object type literals.",
    "src/FunctionDeclarations.ts:7:30 [REQ-027] Function parameter and return annotations must use named object types instead of anonymous object type literals.",
    "src/FunctionDeclarations.ts:7:52 [REQ-027] Function parameter and return annotations must use named object types instead of anonymous object type literals.",
    "src/FunctionDeclarations.ts:10:31 [REQ-027] Function parameter and return annotations must use named object types instead of anonymous object type literals.",
    "src/FunctionDeclarations.ts:10:51 [REQ-027] Function parameter and return annotations must use named object types instead of anonymous object type literals.",
    "src/FunctionSignature.ts:2:20 [REQ-027] Function parameter and return annotations must use named object types instead of anonymous object type literals.",
    "src/FunctionSignature.ts:2:40 [REQ-027] Function parameter and return annotations must use named object types instead of anonymous object type literals.",
  ]);
  assert.match(result.stderr, /\nFAIL\n$/);
});

test("CLI rejects only top-level property and function-parameter intersections [REQ-028]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/PropertyIntersections.ts",
    "class PropertyIntersections {\n" +
      "  private direct: string & number;\n" +
      "  private parenthesized: (string & number);\n" +
      "  private nested: Array<string & number>;\n" +
      "  private returnIntersection(): string & number {\n" +
      '    throw new Error("unreachable");\n' +
      "  }\n" +
      "}\n",
  );
  project.writeFile(
    "src/InterfaceProperty.ts",
    "interface InterfaceProperty {\n" +
      "  direct: string & number;\n" +
      "  nested: Array<string & number>;\n" +
      "}\n",
  );
  project.writeFile(
    "src/ParameterIntersections.ts",
    "function parameterIntersections(\n" +
      "  direct: string & number,\n" +
      "  parenthesized: (string & number),\n" +
      "  nested: Array<string & number>,\n" +
      "): string & number {\n" +
      '  throw new Error("unreachable");\n' +
      "}\n" +
      "const localIntersection: string & number = 1 as never;\n" +
      "const returnedIntersection = (): string & number => {\n" +
      '  throw new Error("unreachable");\n' +
      "};\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const findings = result.stderr
    .split("\n")
    .filter((line) => line.includes("[REQ-028]"));
  assert.equal(findings.length, 5, result.stderr);
  assert.deepEqual(findings, [
    "src/InterfaceProperty.ts:2:11 [REQ-028] Property and function-parameter type annotations must not use top-level intersection types.",
    "src/ParameterIntersections.ts:2:11 [REQ-028] Property and function-parameter type annotations must not use top-level intersection types.",
    "src/ParameterIntersections.ts:3:19 [REQ-028] Property and function-parameter type annotations must not use top-level intersection types.",
    "src/PropertyIntersections.ts:2:19 [REQ-028] Property and function-parameter type annotations must not use top-level intersection types.",
    "src/PropertyIntersections.ts:3:27 [REQ-028] Property and function-parameter type annotations must not use top-level intersection types.",
  ]);
  assert.equal(
    result.stderr.split("\n").filter((line) => line.includes("[REQ-024]")).length,
    2,
  );
  assert.match(result.stderr, /\nFAIL\n$/);
});
