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

test("[PROP-REQ-034-01] eligible repeated strings cross files and respect occurrence and code-point boundaries", (t) => {
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

test("[PROP-REQ-034-01] all REQ-035 and REQ-036 exclusions remain excluded across files", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  const typeofComparisonCases = [
    ["typeof-strict-equal-forward", "===", true],
    ["typeof-strict-equal-reverse", "===", false],
    ["typeof-strict-not-equal-forward", "!==", true],
    ["typeof-strict-not-equal-reverse", "!==", false],
    ["typeof-loose-equal-forward", "==", true],
    ["typeof-loose-equal-reverse", "==", false],
    ["typeof-loose-not-equal-forward", "!=", true],
    ["typeof-loose-not-equal-reverse", "!=", false],
  ];
  const comparisonLine = ([value, operator, typeofOnLeft]) =>
    typeofOnLeft
      ? `typeof runtimeType ${operator} ${JSON.stringify(value)};`
      : `${JSON.stringify(value)} ${operator} typeof runtimeType;`;
  const comparisonsRepeatedTwice = typeofComparisonCases
    .flatMap((comparison) => {
      const line = comparisonLine(comparison);
      return [line, line];
    })
    .join("\n");
  const comparisonsOnce = typeofComparisonCases
    .map(comparisonLine)
    .join("\n");

  project.writeFile(
    "src/ExcludedStrings.ts",
    'import staticFirst from "static-module-only";\n' +
      'import staticSecond from "static-module-only";\n' +
      'void import("dynamic-module-only");\n' +
      'void import("dynamic-module-only");\n' +
      'require("require-argument-only");\n' +
      'require("require-argument-only");\n' +
      'const propertyOne = { "property-key-only": 1 };\n' +
      'const propertyTwo = { "property-key-only": 2 };\n' +
      'const methodOne = { "method-key-only"() {} };\n' +
      'const methodTwo = { "method-key-only"() {} };\n' +
      'declare const elementTargetOne: Record<string, unknown>;\n' +
      'declare const elementTargetTwo: Record<string, unknown>;\n' +
      'elementTargetOne["element-access-key-only"];\n' +
      'elementTargetTwo["element-access-key-only"];\n' +
      'declare const bindingSourceOne: Record<string, number>;\n' +
      'declare const bindingSourceTwo: Record<string, number>;\n' +
      'const { "binding-property-key-only": bindingOne } = bindingSourceOne;\n' +
      'const { "binding-property-key-only": bindingTwo } = bindingSourceTwo;\n' +
      'const computedOne = { ["computed-property-key-only"]: 1 };\n' +
      'const computedTwo = { ["computed-property-key-only"]: 2 };\n' +
      'declare const literalTypeOne: "literal-type-only";\n' +
      'declare const literalTypeTwo: "literal-type-only";\n' +
      'enum EnumValuesOne { First = "enum-member-only" }\n' +
      'enum EnumValuesTwo { First = "enum-member-only" }\n' +
      'enum EnumNamesOne { "enum-name-only" = 1 }\n' +
      'enum EnumNamesTwo { "enum-name-only" = 2 }\n' +
      'const runtimeType = "runtime-value";\n' +
      comparisonsRepeatedTwice +
      "\n",
  );
  project.writeFile(
    "src/MoreExcludedStrings.ts",
    'import staticThird from "static-module-only";\n' +
      'void import("dynamic-module-only");\n' +
      'require("require-argument-only");\n' +
      'const propertyThree = { "property-key-only": 3 };\n' +
      'const methodThree = { "method-key-only"() {} };\n' +
      'declare const elementTargetThree: Record<string, unknown>;\n' +
      'elementTargetThree["element-access-key-only"];\n' +
      'declare const bindingSourceThree: Record<string, number>;\n' +
      'const { "binding-property-key-only": bindingThree } = bindingSourceThree;\n' +
      'const computedThree = { ["computed-property-key-only"]: 3 };\n' +
      'declare const literalTypeThree: "literal-type-only";\n' +
      'enum EnumValuesThree { First = "enum-member-only" }\n' +
      'enum EnumNamesThree { "enum-name-only" = 3 }\n' +
      'const runtimeType = "runtime-value";\n' +
      comparisonsOnce +
      "\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});
