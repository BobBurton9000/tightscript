import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

const CLIENT_DIRECTIVE_PROPERTY_ID = "PROP-REQ-001-01";
const REPEATED_STRING_BOUNDARIES_PROPERTY_ID = "PROP-REQ-004-01";

function configureSourceScope(project) {
  project.writeFile(
    "tightscript.config.json",
    JSON.stringify({ include: ["src/**/*.ts", "src/**/*.tsx"] }),
  );
}

function installNext(project, version = "16.2.0") {
  project.writeFile(
    "node_modules/next/package.json",
    JSON.stringify({ name: "next", version, main: "index.js" }),
  );
  project.writeFile("node_modules/next/index.js", "module.exports = {};\n");
}

function initializeGitRepository(project, trackedFilePaths) {
  execFileSync("git", ["init", "--quiet"], {
    cwd: project.cwd,
    stdio: "ignore",
  });
  execFileSync("git", ["add", "--", ...trackedFilePaths], {
    cwd: project.cwd,
    stdio: "ignore",
  });
}

test(`[${CLIENT_DIRECTIVE_PROPERTY_ID}, REQ-001, REQ-002] supported Next.js context exempts selected non-route client directives regardless of routing configuration`, async (t) => {
  const routingConfigurations = [
    { name: "default routing configuration" },
    {
      name: "changed routing configuration",
      source: 'module.exports = { pageExtensions: ["page.tsx"] };\n',
    },
    {
      name: "indeterminate routing configuration",
      source:
        "module.exports = { pageExtensions: process.env.PAGE_EXTENSIONS };\n",
    },
  ];

  for (const routingConfiguration of routingConfigurations) {
    await t.test(routingConfiguration.name, (subtest) => {
      const project = createTemporaryProject(subtest);
      configureSourceScope(project);
      installNext(project);
      project.writeFile("src/guide.md", "# Test fixture guide\n");
      initializeGitRepository(project, ["src/guide.md"]);
      if (routingConfiguration.source !== undefined) {
        project.writeFile("next.config.js", routingConfiguration.source);
      }
      project.writeFile(
        "src/components/ClientBoundary.ts",
        "// @see [test fixture guide](../guide.md)\n" +
          '"use strict";\n' +
          "/* @see [test fixture guide](../guide.md) */\n" +
          "'use client';\n",
      );
      project.writeFile(
        "src/widgets/ClientPanel.tsx",
        "'use client';\n",
      );
      project.writeFile("src/shared/ClientValues.ts", '"use client";\n');

      const result = runCli(project.cwd);

      assert.ifError(result.error);
      assert.equal(result.signal, null);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, "PASS\n");
      assert.equal(result.stderr, "");
    });
  }
});

test(`[${CLIENT_DIRECTIVE_PROPERTY_ID}] post-prologue strings, parenthesized literals, templates, and ordinary values remain countable`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  installNext(project);
  const sourceLines = [
    '"use strict";',
    "const afterPrologue = true;",
    '"use client";',
    "'use client';",
    '"use client";',
    '("use client");',
    "('use client');",
    '("use client");',
    "const templateOne = `use client`;",
    "const templateTwo = `use client`;",
    "const templateThree = `use client`;",
    'const ordinaryOne = "use client";',
    "const ordinaryTwo = 'use client';",
    'const ordinaryThree = "use client";',
  ];
  project.writeFile("src/DirectiveForms.ts", `${sourceLines.join("\n")}\n`);

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const diagnostics = result.stderr
    .split("\n")
    .filter((line) => line.includes("[REQ-034]"));
  assert.equal(diagnostics.length, 12, result.stderr);
  assert.deepEqual(
    diagnostics.map((line) =>
      Number(line.match(/:(\d+):\d+ \[REQ-034\]/)?.[1]),
    ),
    Array.from({ length: 12 }, (_, index) => index + 3),
  );
  assert.match(result.stderr, /\nFAIL\n$/);
});

for (const scenario of [
  { name: "absent", version: null },
  { name: "unsupported", version: "15.4.1" },
  { name: "indeterminate", version: "not-a-semver" },
]) {
  test(`[${CLIENT_DIRECTIVE_PROPERTY_ID}] ${scenario.name} Next.js context does not exempt qualifying directives`, (t) => {
    const project = createTemporaryProject(t);
    configureSourceScope(project);
    if (scenario.version !== null) {
      installNext(project, scenario.version);
    }
    const directives = [
      ["src/ClientA.ts", '"use client";\n'],
      ["src/ClientB.tsx", "'use client';\n"],
      ["src/ClientC.ts", '"use client";\n'],
    ];
    for (const [filePath, contents] of directives) {
      project.writeFile(filePath, contents);
    }

    const result = runCli(project.cwd);

    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    const diagnostics = result.stderr
      .split("\n")
      .filter((line) => line.includes("[REQ-034]"));
    assert.equal(diagnostics.length, 3, result.stderr);
    assert.deepEqual(
      diagnostics.map((line) => line.match(/^(.*):\d+:\d+ \[REQ-034\]/)?.[1]),
      directives.map(([filePath]) => filePath),
    );
    assert.match(result.stderr, /\nFAIL\n$/);
  });
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

test(`[${REPEATED_STRING_BOUNDARIES_PROPERTY_ID}, REQ-004] all REQ-035 and REQ-036 exclusions remain excluded with supported Next.js directives`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  installNext(project);
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
    '"use client";\n' +
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
    "'use client';\n" +
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
  project.writeFile("src/LastExcludedStrings.tsx", '"use client";\n');

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});

test(`[${REPEATED_STRING_BOUNDARIES_PROPERTY_ID}, REQ-004] supported context preserves repeated-string thresholds, Unicode boundaries, and cross-file counting`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  installNext(project);
  project.writeFile(
    "src/First.ts",
    '"use client";\n' +
      'const twoOccurrenceFirst = "occurs-twice";\n' +
      'const countedFirst = "cross-file-value";\n' +
      'const shortFirst = "xy";\n' +
      'const shortSecond = "xy";\n' +
      'const shortThird = "xy";\n' +
      'const twoCodePointFirst = "😀😃";\n' +
      'const twoCodePointSecond = "😀😃";\n' +
      'const twoCodePointThird = "😀😃";\n' +
      'const threeCodePointFirst = "😀ab";\n',
  );
  project.writeFile(
    "src/Second.ts",
    "'use client';\n" +
      'const twoOccurrenceSecond = "occurs-twice";\n' +
      'const countedSecond = "cross-file-value";\n',
  );
  project.writeFile(
    "src/Third.tsx",
    '"use client";\n' +
      'const countedThird = "cross-file-value";\n' +
      'const threeCodePointSecond = "😀ab";\n' +
      'const threeCodePointThird = "😀ab";\n',
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
      "src/First.ts:3",
      "src/First.ts:10",
      "src/Second.ts:3",
      "src/Third.tsx:2",
      "src/Third.tsx:3",
      "src/Third.tsx:4",
    ],
  );
  assert.equal(diagnostics.length, 6, result.stderr);
  assert.doesNotMatch(result.stderr, /use client|occurs-twice|"xy"|😀😃/);
  assert.match(result.stderr, /\nFAIL\n$/);
});

test(`[${REPEATED_STRING_BOUNDARIES_PROPERTY_ID}, REQ-005] configured source selection excludes out-of-scope paths and extensions`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  installNext(project);
  project.writeFile(
    "src/SelectedA.ts",
    '"use client";\n' +
      'const pathControlFirst = "path-boundary";\n' +
      'const extensionControlFirst = "extension-boundary";\n',
  );
  project.writeFile(
    "src/SelectedB.tsx",
    "'use client';\n" +
      'const pathControlSecond = "path-boundary";\n' +
      'const extensionControlSecond = "extension-boundary";\n',
  );
  project.writeFile(
    "outside/OutOfPattern.ts",
    'const pathControlThird = "path-boundary";\n' +
      'const pathControlFourth = "path-boundary";\n',
  );
  project.writeFile(
    "src/legacy.js",
    'const extensionControlThird = "extension-boundary";\n',
  );
  project.writeFile(
    "src/legacy.jsx",
    'const extensionControlFourth = "extension-boundary";\n',
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});

test("[PROP-REQ-034-01] static re-export module specifiers count as eligible repeated strings", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile("src/Types.ts", "export interface Types {}\n");
  for (const fileName of ["ReexportA.ts", "ReexportB.ts", "ReexportC.ts"]) {
    project.writeFile(
      `src/${fileName}`,
      'export type { Types } from "./Types.js";\n',
    );
  }

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const diagnostics = result.stderr
    .split("\n")
    .filter((line) => line.includes("[REQ-034]"));
  assert.equal(diagnostics.length, 3, result.stderr);
  assert.deepEqual(
    diagnostics.map((line) => line.match(/^(.*:\d+):\d+ \[REQ-034\]/)?.[1]),
    [
      "src/ReexportA.ts:1",
      "src/ReexportB.ts:1",
      "src/ReexportC.ts:1",
    ],
  );
  assert.match(result.stderr, /\nFAIL\n$/);
});
