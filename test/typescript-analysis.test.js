import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { createTypeScriptAnalysis } from "../bin/typescript-analysis.js";

function selectedFile(project, relativePath) {
  return {
    filePath: resolve(project.cwd, relativePath),
    displayPath: relativePath,
  };
}

test("TypeScript analysis uses selected roots and tsconfig compiler options [REQ-005, REQ-006]", (t) => {
  const project = createTemporaryProject(t);
  const selectedPath = project.writeFile("selected.ts", "export const selected = 1;\n");
  project.writeFile("config-only.ts", "export const configOnly = 1;\n");
  project.writeFile(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: { target: "ES2022" },
      files: ["config-only.ts"],
      include: ["config-only.ts"],
      exclude: ["selected.ts"],
    }),
  );

  const analysis = createTypeScriptAnalysis(
    [selectedFile(project, "selected.ts")],
    project.cwd,
  );

  assert.deepEqual(analysis.evaluationErrors, []);
  assert.deepEqual(analysis.program.getRootFileNames(), [selectedPath]);
  assert.equal(analysis.program.getCompilerOptions().target, ts.ScriptTarget.ES2022);
  assert.deepEqual(
    analysis.sourceFiles.map((source) => source.displayPath),
    ["selected.ts"],
  );
});

test("TypeScript analysis fails closed for selected-file parse errors [REQ-005]", (t) => {
  const project = createTemporaryProject(t);
  project.writeFile("broken.ts", "const selectedValue = ;\n");

  const analysis = createTypeScriptAnalysis(
    [selectedFile(project, "broken.ts")],
    project.cwd,
  );

  assert.ok(
    analysis.evaluationErrors.some(
      (error) =>
        error.kind === "source-syntax" &&
        error.filePath === "broken.ts" &&
        error.line === 1,
    ),
  );
});

test("TypeScript analysis fails closed when a selected file cannot be read [REQ-005]", (t) => {
  const project = createTemporaryProject(t);
  const analysis = createTypeScriptAnalysis(
    [selectedFile(project, "removed-after-scope.ts")],
    project.cwd,
  );

  assert.deepEqual(
    analysis.evaluationErrors.map((error) => [error.kind, error.filePath]),
    [["source-read", "removed-after-scope.ts"]],
  );
});

test("TypeScript analysis fails closed for malformed compiler configuration [REQ-005]", async (t) => {
  const invalidConfigurations = [
    ["malformed JSON", '{"compilerOptions":'],
    [
      "invalid compiler option",
      JSON.stringify({ compilerOptions: { target: "not-a-typescript-target" } }),
    ],
  ];

  for (const [caseName, configurationContents] of invalidConfigurations) {
    await t.test(caseName, (subtest) => {
      const project = createTemporaryProject(subtest);
      project.writeFile("valid.ts", "export {};\n");
      project.writeFile("tsconfig.json", configurationContents);

      const analysis = createTypeScriptAnalysis(
        [selectedFile(project, "valid.ts")],
        project.cwd,
      );

      assert.ok(
        analysis.evaluationErrors.some(
          (error) => error.kind === "compiler-config" && error.code !== undefined,
        ),
      );
    });
  }
});

test("unrelated TypeScript type errors do not make policy analysis incomplete [REQ-005]", (t) => {
  const project = createTemporaryProject(t);
  project.writeFile(
    "type-error.ts",
    "const text: string = 42;\nexport { text };\n",
  );

  const analysis = createTypeScriptAnalysis(
    [selectedFile(project, "type-error.ts")],
    project.cwd,
  );
  const typeDiagnostics = analysis.program.getSemanticDiagnostics(
    analysis.sourceFiles[0].sourceFile,
  );

  assert.ok(typeDiagnostics.some((diagnostic) => diagnostic.code === 2322));
  assert.deepEqual(analysis.evaluationErrors, []);
});

test("required unresolved semantic information makes analysis incomplete [REQ-005]", (t) => {
  const project = createTemporaryProject(t);
  project.writeFile("unresolved.ts", "export const value = missingValue;\n");

  const analysis = createTypeScriptAnalysis(
    [selectedFile(project, "unresolved.ts")],
    project.cwd,
  );
  const sourceFile = analysis.sourceFiles[0].sourceFile;
  let unresolvedIdentifier;
  function findUnresolvedIdentifier(node) {
    if (ts.isIdentifier(node) && node.text === "missingValue") {
      unresolvedIdentifier = node;
      return;
    }
    ts.forEachChild(node, findUnresolvedIdentifier);
  }
  findUnresolvedIdentifier(sourceFile);

  const unresolvedSymbol = analysis.checker.getSymbolAtLocation(unresolvedIdentifier);
  assert.equal(unresolvedSymbol, undefined);
  assert.equal(
    analysis.requireResolvedSemanticInformation(
      unresolvedSymbol,
      unresolvedIdentifier,
      "REQ-018 callable export information",
    ),
    undefined,
  );
  assert.deepEqual(
    analysis.evaluationErrors.map((error) => [error.kind, error.filePath, error.line]),
    [["semantic-resolution", "unresolved.ts", 1]],
  );
});
