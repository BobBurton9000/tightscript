import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

const PROPERTY_ID = "PROP-REQ-004-01";

function compareDiagnostics(left, right) {
  if (left.filePath < right.filePath) return -1;
  if (left.filePath > right.filePath) return 1;
  if (left.line !== right.line) return left.line - right.line;
  if (left.column !== right.column) return left.column - right.column;
  if (left.requirementId < right.requirementId) return -1;
  if (left.requirementId > right.requirementId) return 1;
  return 0;
}

test(`[${PROPERTY_ID}] every policy diagnostic identifies its file, location, and requirement`, (t) => {
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
  project.writeFile("docs/guide.md", "# Guide\n");
  project.writeFile("support/source.ts", "export const upstream = 1;\n");

  const overflowSource = `${Array.from(
    { length: 601 },
    (_, lineIndex) => `const value${lineIndex} = ${lineIndex};`,
  ).join("\n")}\n`;
  const diagnosticFixtures = [
    {
      filePath: "src/BadComment.ts",
      source: "// explanatory prose\n",
      expected: [{ line: 1, column: 1, requirementId: "REQ-010" }],
    },
    {
      filePath: "src/BadFragment.ts",
      source: "// @see [guide](../docs/guide.md#missing)\n",
      expected: [{ line: 1, column: 1, requirementId: "REQ-013" }],
    },
    {
      filePath: "src/BadLink.ts",
      source: "// @see [guide](./missing.md)\n",
      expected: [{ line: 1, column: 1, requirementId: "REQ-012" }],
    },
    {
      filePath: "src/BadName.ts",
      source: "export class OtherName {}\n",
      expected: [{ line: 1, column: 1, requirementId: "REQ-015" }],
    },
    {
      filePath: "src/Callable.ts",
      source: "export function run() {}\n",
      expected: [{ line: 1, column: 17, requirementId: "REQ-018" }],
    },
    {
      filePath: "src/ExplicitCallable.ts",
      source: "export interface ExplicitCallable extends CallableFunction {}\n",
      expected: [{ line: 1, column: 43, requirementId: "REQ-026" }],
    },
    {
      filePath: "src/CommentSuppression.ts",
      source: "// @ts-ignore\nlet ignored = 1;\n",
      expected: [
        { line: 1, column: 1, requirementId: "REQ-014" },
        { line: 2, column: 1, requirementId: "REQ-009" },
      ],
    },
    {
      filePath: "src/Else.ts",
      source: "if (condition) {} else {}\n",
      expected: [{ line: 1, column: 19, requirementId: "REQ-032" }],
    },
    {
      filePath: "src/ExportedObject.ts",
      source: "export const objectValue = {};\n",
      expected: [{ line: 1, column: 14, requirementId: "REQ-021" }],
    },
    {
      filePath: "src/Getter.ts",
      source: "function getValue() {}\n",
      expected: [{ line: 1, column: 1, requirementId: "REQ-031" }],
    },
    {
      filePath: "src/ImportPassthrough.ts",
      source:
        'import { upstream } from "../support/source.js";\nexport { upstream };\n',
      expected: [{ line: 1, column: 10, requirementId: "REQ-019" }],
    },
    {
      filePath: "src/Base.ts",
      source:
        "export interface Base {\n  (): void;\n  new (): object;\n}\n",
      expected: [
        { line: 2, column: 3, requirementId: "REQ-024" },
        { line: 3, column: 3, requirementId: "REQ-024" },
      ],
    },
    {
      filePath: "src/Child.ts",
      source:
        'import type { Base } from "./Base.js";\n' +
        "export interface Child extends Base {}\n",
      expected: [
        { line: 2, column: 32, requirementId: "REQ-024" },
        { line: 2, column: 32, requirementId: "REQ-024" },
      ],
    },
    {
      filePath: "src/Grandchild.ts",
      source:
        'import type { Child } from "./Child.js";\n' +
        "export interface Grandchild extends Child {}\n",
      expected: [
        { line: 2, column: 37, requirementId: "REQ-024" },
        { line: 2, column: 37, requirementId: "REQ-024" },
      ],
    },
    {
      filePath: "src/InterfaceCall.ts",
      source: "interface Callable {\n  (): void;\n}\n",
      expected: [{ line: 2, column: 3, requirementId: "REQ-024" }],
    },
    {
      filePath: "src/InterfaceConstruct.ts",
      source: "interface Constructable {\n  new (): object;\n}\n",
      expected: [{ line: 2, column: 3, requirementId: "REQ-024" }],
    },
    {
      filePath: "src/InterfaceData.ts",
      source: "interface Data {\n  value: string;\n}\n",
      expected: [{ line: 2, column: 3, requirementId: "REQ-024" }],
    },
    {
      filePath: "src/InterfaceIndex.ts",
      source: "interface Index {\n  [key: string]: unknown;\n}\n",
      expected: [{ line: 2, column: 3, requirementId: "REQ-024" }],
    },
    {
      filePath: "src/Many.ts",
      source: "class First {}\nclass Second {}\n",
      expected: [{ line: 2, column: 1, requirementId: "REQ-017" }],
    },
    {
      filePath: "src/NamedReexport.ts",
      source: 'export { upstream as namedPassThrough } from "../support/source.js";\n',
      expected: [{ line: 1, column: 10, requirementId: "REQ-019" }],
    },
    {
      filePath: "src/Overflow.ts",
      source: overflowSource,
      expected: [{ line: 601, column: 1, requirementId: "REQ-016" }],
    },
    {
      filePath: "src/PrivateState.ts",
      source: "class State {\n  value = 1;\n  operation() {}\n}\n",
      expected: [{ line: 2, column: 3, requirementId: "REQ-022" }],
    },
    {
      filePath: "src/SeparateExport.ts",
      source: "const localValue = 1;\nexport { localValue };\n",
      expected: [{ line: 2, column: 10, requirementId: "REQ-020" }],
    },
    {
      filePath: "src/StarReexport.ts",
      source: 'export * from "../support/source.js";\n',
      expected: [{ line: 1, column: 1, requirementId: "REQ-019" }],
    },
    {
      filePath: "src/TypeAnnotation.ts",
      source:
        "function transform(value: { input: string }): { output: string } { return {} as never; }\n",
      expected: [
        { line: 1, column: 27, requirementId: "REQ-027" },
        { line: 1, column: 47, requirementId: "REQ-027" },
      ],
    },
    {
      filePath: "src/TypeIntersection.ts",
      source:
        "class Intersection {\n  private value: string & number;\n}\n" +
        "function accept(value: string & number): void {}\n",
      expected: [
        { line: 2, column: 18, requirementId: "REQ-028" },
        { line: 4, column: 24, requirementId: "REQ-028" },
      ],
    },
    {
      filePath: "src/TypeRules.ts",
      source: "type State = string | number;\n",
      expected: [
        { line: 1, column: 1, requirementId: "REQ-029" },
        { line: 1, column: 14, requirementId: "REQ-030" },
      ],
    },
    {
      filePath: "src/ParameterLayout.ts",
      source: "function call(first: string, second: string): void {}\n",
      expected: [{ line: 1, column: 30, requirementId: "REQ-033" }],
    },
    {
      filePath: "src/RepeatedA.ts",
      source:
        'const alpha = "shared-value";\nconst bravo = "shared-value";\n',
      expected: [
        { line: 1, column: 15, requirementId: "REQ-034" },
        { line: 2, column: 15, requirementId: "REQ-034" },
      ],
    },
    {
      filePath: "src/RepeatedB.ts",
      source: 'const delta = "shared-value";\n',
      expected: [{ line: 1, column: 15, requirementId: "REQ-034" }],
    },
  ];

  for (const fixture of diagnosticFixtures) {
    project.writeFile(fixture.filePath, fixture.source);
  }

  execFileSync("git", ["init", "--quiet"], {
    cwd: project.cwd,
    stdio: "ignore",
  });
  execFileSync("git", ["add", "--", "docs/guide.md"], {
    cwd: project.cwd,
    stdio: "ignore",
  });

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /\nFAIL\n$/);

  const actualDiagnostics = result.stderr
    .split("\n")
    .filter((line) => /^\S+:\d+:\d+ \[REQ-\d{3}\] /u.test(line))
    .map((line) => {
      const match = line.match(/^(.*):(\d+):(\d+) \[(REQ-\d{3})\] /u);
      assert.ok(match, `Expected a located policy diagnostic: ${line}`);
      return {
        filePath: match[1],
        line: Number(match[2]),
        column: Number(match[3]),
        requirementId: match[4],
      };
    });
  const expectedDiagnostics = diagnosticFixtures
    .flatMap(({ filePath, expected }) =>
      expected.map((diagnostic) => ({ filePath, ...diagnostic })),
    )
    .sort(compareDiagnostics);

  assert.deepEqual(actualDiagnostics, expectedDiagnostics, result.stderr);
});
