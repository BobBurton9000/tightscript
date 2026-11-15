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

test("CLI rejects lowercase get-prefixed functions, variables, and methods [REQ-031]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/Names.ts",
    "function getFunction() {}\n" +
      "function existingFunction() {}\n" +
      "const getArrow = () => {};\n" +
      "const getAlias = existingFunction;\n" +
      "const object = {\n" +
      "  getMethod() {},\n" +
      "  getProperty: function () {},\n" +
      "  getAlias: existingFunction,\n" +
      "  getNumber: 1,\n" +
      "};\n" +
      "class Service {\n" +
      "  getClassMethod() {}\n" +
      "}\n" +
      "const shape: {\n" +
      "  getMethod(): void;\n" +
      "  getProperty: () => void;\n" +
      "  ordinaryMethod(): void;\n" +
      "  ordinaryProperty: () => void;\n" +
      "} = {} as never;\n" +
      "function GetAllowed() {}\n" +
      "const getNumber = 1;\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const diagnostics = result.stderr
    .split("\n")
    .filter((line) => line.includes("[REQ-031]"));
  assert.equal(diagnostics.length, 9, result.stderr);
  assert.deepEqual(
    diagnostics.map((line) => Number(line.match(/:(\d+):\d+ \[REQ-031\]/)?.[1])),
    [1, 3, 4, 6, 7, 8, 12, 15, 16],
  );
  assert.match(result.stderr, /\nFAIL\n$/);
  assert.doesNotMatch(result.stderr, /\[REQ-005\]|GetAllowed|ordinaryMethod|ordinaryProperty/);
});

test("CLI rejects else and else-if branches [REQ-032]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/ElseBranches.ts",
    "if (condition) {\n" +
      "  const value = 1;\n" +
      "} else {\n" +
      "  const fallback = 2;\n" +
      "}\n" +
      "if (otherCondition) {\n" +
      "  const value = 1;\n" +
      "} else if (thirdCondition) {\n" +
      "  const other = 2;\n" +
      "} else {\n" +
      "  const last = 3;\n" +
      "}\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "src/ElseBranches.ts:3:3 [REQ-032] else and else if branches are not permitted.\n" +
      "src/ElseBranches.ts:8:3 [REQ-032] else and else if branches are not permitted.\n" +
      "src/ElseBranches.ts:10:3 [REQ-032] else and else if branches are not permitted.\n" +
      "FAIL\n",
  );
});

test("CLI rejects invalid multiline parameter layouts across declarations, expressions, types, and signatures [REQ-033]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/ParameterLayouts.ts",
    "function badDeclaration(first: string, second: string): void {}\n" +
      "const badFunctionExpression = function (first: string, second: string): void {};\n" +
      "const badArrow = (first: string, second: string) => first;\n" +
      "const badTypes: {\n" +
      "  callback: (first: string, second: string) => string;\n" +
      "  factory: new (first: string, second: string) => object;\n" +
      "  method(first: string, second: string): void;\n" +
      "  (first: string, second: string): void;\n" +
      "  new (first: string, second: string): object;\n" +
      "} = {} as never;\n" +
      "class BadService {\n" +
      "  method(first: string, second: string): void {}\n" +
      "  constructor(first: string, second: string) {}\n" +
      "}\n" +
      "function badParameters(\n" +
      "  first: string, second: string\n" +
      "): void {}\n" +
      "function badOpen(first: string,\n" +
      "  second: string\n" +
      "): void {}\n" +
      "function badClose(\n" +
      "  first: string,\n" +
      "  second: string): void {}\n" +
      "function good(\n" +
      "  first: string,\n" +
      "  second: string,\n" +
      "): void {}\n" +
      "good(\"first\", \"second\");\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const diagnostics = result.stderr
    .split("\n")
    .filter((line) => line.includes("[REQ-033]"));
  assert.equal(diagnostics.length, 13, result.stderr);
  assert.deepEqual(
    diagnostics.map((line) => Number(line.match(/:(\d+):\d+ \[REQ-033\]/)?.[1])),
    [1, 2, 3, 5, 6, 7, 8, 9, 12, 13, 16, 18, 23],
  );
  assert.match(result.stderr, /\nFAIL\n$/);
  assert.doesNotMatch(result.stderr, /\[REQ-005\]/);
});

test("CLI accepts multiline parameters and does not apply REQ-033 to call expressions [REQ-033]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/ValidParameterLayouts.ts",
    "function declaration(\n" +
      "  first: string,\n" +
      "  second: string,\n" +
      "): void {}\n" +
      "const functionExpression = function (\n" +
      "  first: string,\n" +
      "  second: string,\n" +
      "): string { return first; };\n" +
      "const arrow = (\n" +
      "  first: string,\n" +
      "  second: string,\n" +
      ") => first;\n" +
      "const types: {\n" +
      "  callback: (\n" +
      "    first: string,\n" +
      "    second: string,\n" +
      "  ) => string;\n" +
      "  factory: new (\n" +
      "    first: string,\n" +
      "    second: string,\n" +
      "  ) => object;\n" +
      "  method(\n" +
      "    first: string,\n" +
      "    second: string,\n" +
      "  ): void;\n" +
      "  (\n" +
      "    first: string,\n" +
      "    second: string,\n" +
      "  ): void;\n" +
      "  new (\n" +
      "    first: string,\n" +
      "    second: string,\n" +
      "  ): object;\n" +
      "} = {} as never;\n" +
      "class Service {\n" +
      "  method(\n" +
      "    first: string,\n" +
      "    second: string,\n" +
      "  ): void {}\n" +
      "  constructor(\n" +
      "    first: string,\n" +
      "    second: string,\n" +
      "  ) {}\n" +
      "}\n" +
      "const result = functionExpression(\"first\", \"second\");\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});
