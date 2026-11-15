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

function declarations(count) {
  return Array.from(
    { length: count },
    (_, index) => `const value${index} = ${index};\n`,
  ).join("");
}

test("CLI enforces exported class and interface basenames [REQ-015]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile("src/BadClass.ts", "export class OtherClass {}\n");
  project.writeFile("src/BadInterface.tsx", "export interface OtherInterface {}\n");
  project.writeFile(
    "src/local-export.ts",
    "class LocalExport {}\nexport { LocalExport as PublicName };\n",
  );
  project.writeFile("src/MatchingClass.ts", "export class MatchingClass {}\n");
  project.writeFile(
    "src/MatchingInterface.tsx",
    "export interface MatchingInterface {}\n",
  );
  project.writeFile("src/index.ts", "export class AnyName {}\n");
  project.writeFile("src/not-exported.ts", "class AnyName {}\n");

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(
    result.stderr,
    /^src\/BadClass\.ts:1:1 \[REQ-015\] Exported class or interface "OtherClass" must match the file basename "BadClass"\.\n/,
  );
  assert.match(
    result.stderr,
    /src\/BadInterface\.tsx:1:1 \[REQ-015\] Exported class or interface "OtherInterface" must match the file basename "BadInterface"\./,
  );
  assert.match(
    result.stderr,
    /src\/local-export\.ts:1:1 \[REQ-015\] Exported class or interface "LocalExport" must match the file basename "local-export"\./,
  );
  assert.match(result.stderr, /\nFAIL\n$/);
  assert.doesNotMatch(result.stderr, /MatchingClass|MatchingInterface|AnyName/);
});

test("CLI enforces the 600-effective-line limit and excludes import-only lines [REQ-016]", async (t) => {
  const cases = [
    {
      name: "multiline import lines are excluded at the exact limit",
      contents: `import {\n  ImportedValue,\n} from "dependency";\n${declarations(600)}`,
      status: 0,
    },
    {
      name: "the 601st effective line fails after a multiline import",
      contents: `import {\n  ImportedValue,\n} from "dependency";\n${declarations(601)}`,
      status: 1,
      location: "src/Lines.ts:604:1 [REQ-016]",
    },
    {
      name: "blank lines count",
      contents: `${declarations(600)}\n`,
      status: 1,
      location: "src/Lines.ts:601:1 [REQ-016]",
    },
    {
      name: "comment-only lines count",
      contents: `${declarations(600)}// a comment\n`,
      status: 1,
      location: "src/Lines.ts:601:1 [REQ-016]",
    },
    {
      name: "a comment on an import line makes that line effective",
      contents: `import ImportedValue from "dependency"; // comment\n${declarations(600)}`,
      status: 1,
      location: "src/Lines.ts:601:1 [REQ-016]",
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, (subtest) => {
      const project = createTemporaryProject(subtest);
      configureSourceScope(project);
      project.writeFile("src/Lines.ts", testCase.contents);
      const result = runCli(project.cwd);

      assert.ifError(result.error);
      assert.equal(result.signal, null);
      assert.equal(result.status, testCase.status);
      if (testCase.status === 0) {
        assert.equal(result.stdout, "PASS\n");
        assert.equal(result.stderr, "");
      } else {
        assert.equal(result.stdout, "");
        assert.ok(result.stderr.includes(testCase.location), result.stderr);
        assert.match(result.stderr, /\nFAIL\n$/);
      }
    });
  }
});

test("CLI limits each file to one class declaration, class expression, or interface [REQ-017]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  project.writeFile(
    "src/Many.ts",
    "class First {}\nconst second = class {};\ninterface Third {}\n",
  );
  project.writeFile("src/Single.ts", "interface Single {}\n");
  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "src/Many.ts:2:16 [REQ-017] A source file may contain at most one class declaration, class expression, or interface.\nFAIL\n",
  );
});
