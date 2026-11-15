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

test("CLI counts eligible repeated strings across files at the exact occurrence and code-point boundaries [REQ-034]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/Strings.ts",
    'const sameValueOne = "same-value";\n' +
      "const sameValueTwo = 'same-value';\n" +
      "const sameValueThree = `same-value`;\n" +
      'const sameValueFour = "same-value";\n' +
      'const twoOccurrenceFirst = "occurs-twice";\n' +
      'const shortFirst = "xy";\n' +
      'const shortSecond = "xy";\n' +
      'const shortThird = "xy";\n' +
      'const supplementaryFirst = "😀😃";\n' +
      'const supplementarySecond = "😀😃";\n' +
      'const supplementaryThird = "😀😃";\n' +
      'const threeCodePointFirst = "😀ab";\n' +
      "const threeCodePointSecond = '😀ab';\n",
  );
  project.writeFile(
    "src/MoreStrings.ts",
    "const threeCodePointThird = `😀ab`;\n" +
      'const sameValueFifth = "same-value";\n' +
      'const twoOccurrenceSecond = "occurs-twice";\n',
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const diagnostics = result.stderr
    .split("\n")
    .filter((line) => line.includes("[REQ-034]"));
  assert.deepEqual(
    diagnostics.map((line) => line.match(/^(.*:\d+):\d+ \[REQ-034\]/)?.[1]),
    [
      "src/MoreStrings.ts:1",
      "src/MoreStrings.ts:2",
      "src/Strings.ts:1",
      "src/Strings.ts:2",
      "src/Strings.ts:3",
      "src/Strings.ts:4",
      "src/Strings.ts:12",
      "src/Strings.ts:13",
    ],
  );
  assert.equal(diagnostics.length, 8, result.stderr);
  assert.match(result.stderr, /\nFAIL\n$/);
  assert.doesNotMatch(result.stderr, /occurs-twice|"xy"|😀😃/);
});

test("CLI excludes REQ-035 literal contexts and direct REQ-036 typeof comparisons in either operand order [REQ-034, REQ-035, REQ-036]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/ExcludedStrings.ts",
    'import staticFirst from "static-module-only";\n' +
      'import staticSecond from "static-module-only";\n' +
      'import staticThird from "static-module-only";\n' +
      'void import("dynamic-module-only");\n' +
      'void import("dynamic-module-only");\n' +
      'void import("dynamic-module-only");\n' +
      'require("require-argument-only");\n' +
      'require("require-argument-only");\n' +
      'require("require-argument-only");\n' +
      'const property = { "property-key-only": 1 };\n' +
      'const method = { "property-key-only"() {} };\n' +
      'property["property-key-only"];\n' +
      'const { "property-key-only": propertyValue } = property;\n' +
      'declare const literalTypeOne: "literal-type-only";\n' +
      'declare const literalTypeTwo: "literal-type-only";\n' +
      'declare const literalTypeThree: "literal-type-only";\n' +
      'enum EnumValues { First = "enum-member-only", Second = "enum-member-only", Third = "enum-member-only" }\n' +
      'enum EnumNameOne { "enum-name-only" = 1 }\n' +
      'enum EnumNameTwo { "enum-name-only" = 2 }\n' +
      'enum EnumNameThree { "enum-name-only" = 3 }\n' +
      'const runtimeType = "runtime-value";\n' +
      'typeof runtimeType === "typeof-comparison-only";\n' +
      '"typeof-comparison-only" !== typeof runtimeType;\n' +
      'typeof runtimeType == "typeof-comparison-only";\n' +
      '"typeof-comparison-only" != typeof runtimeType;\n',
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});
