import assert from "node:assert/strict";
import test from "node:test";
import { analyzeFrameworkCompatibility } from "../bin/compatibility-analyser.js";
import { createTypeScriptAnalysis } from "../bin/typescript-analysis.js";
import { createTemporaryProject } from "../test-support/temp-project.js";

function configureReactProject(project, jsx = "react") {
  project.writeFile(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        jsx,
        module: "CommonJS",
        moduleResolution: "Node",
        skipLibCheck: true,
      },
    }),
  );
  project.writeFile(
    "node_modules/react/package.json",
    JSON.stringify({ name: "react", version: "19.0.0", types: "index.d.ts" }),
  );
  project.writeFile(
    "node_modules/react/index.d.ts",
    `export namespace JSX {
` +
      `  export interface Element { readonly __element?: unique symbol; }
` +
      `  export interface IntrinsicElements { div: { id?: string }; }
` +
      `  export type ElementType = (props: any) => Element | null;
` +
      `}
` +
      `export function createElement(...args: any[]): JSX.Element;
` +
      `export function memo<T extends (props: any) => JSX.Element | null>(component: T): T;
` +
      `export function forwardRef<T extends (props: any) => JSX.Element | null>(component: T): T;
` +
      `export function unknownWrapper<T>(component: T): T;
`,
  );
  project.writeFile(
    "node_modules/react/jsx-runtime.d.ts",
    `export namespace JSX {
` +
      `  export interface Element { readonly __element?: unique symbol; }
` +
      `  export interface IntrinsicElements { div: { id?: string }; }
` +
      `  export type ElementType = (props: any) => Element | null;
` +
      `}
` +
      `export function jsx(type: any, props: any, key?: any): JSX.Element;
` +
      `export function jsxs(type: any, props: any, key?: any): JSX.Element;
` +
      `export const Fragment: {};
`,
  );
}

function createAnalysis(project, relativePath, contents) {
  const filePath = project.writeFile(relativePath, contents);
  return createTypeScriptAnalysis(
    [{ filePath, displayPath: relativePath }],
    project.cwd,
  );
}

function decisionFor(compatibility, exportName) {
  return compatibility.decisions.find(
    (decision) => decision.exportName === exportName,
  );
}

function installNext(project, version) {
  project.writeFile(
    "node_modules/next/package.json",
    JSON.stringify({ name: "next", version, main: "index.js" }),
  );
  project.writeFile("node_modules/next/index.js", "module.exports = {};\n");
}

test("compatibility analyser accepts direct, aliased, reviewed-wrapped, and local-wrapper React exports [REQ-004]", (t) => {
  const project = createTemporaryProject(t);
  configureReactProject(project);
  const analysis = createAnalysis(
    project,
    "src/Components.tsx",
    `import { memo as reviewedMemo, forwardRef } from "react";\n` +
      `export function Direct() { return null; }\n` +
      `const Local = () => null;\n` +
      `const Alias = Local;\n` +
      `export default Alias;\n` +
      `export const Memoed = reviewedMemo(Local);\n` +
      `export const Forwarded = forwardRef(Local);\n` +
      `function localWrapper(Component: () => null) { return Component; }\n` +
      `export const LocalWrapped = localWrapper(Local);\n`,
  );

  const compatibility = analyzeFrameworkCompatibility(analysis, { cwd: project.cwd });

  for (const exportName of ["Direct", "default", "Memoed", "Forwarded", "LocalWrapped"]) {
    assert.equal(decisionFor(compatibility, exportName)?.outcome, "eligible", exportName);
  }
  assert.equal(analysis.evaluationErrors.length, 0);
});

test("compatibility analyser rejects re-exports, imported aliases, unknown wrappers, unrelated occurrences, and imported final branches [REQ-004, REQ-006]", (t) => {
  const project = createTemporaryProject(t);
  configureReactProject(project);
  project.writeFile("src/remote.ts", "export function Remote() { return null; }\n");
  const analysis = createAnalysis(
    project,
    "src/Exports.tsx",
    `import { Remote } from "./remote";\n` +
      `import { unknownWrapper } from "react";\n` +
      `export { Remote as Reexported } from "./remote";\n` +
      `export const Imported = Remote;\n` +
      `const ImportedAlias = Imported;\n` +
      `export const AliasedImport = ImportedAlias;\n` +
      `const Local = () => null;\n` +
      `export const UnknownWrapper = unknownWrapper(Local);\n` +
      `function choose(local: () => null, remote: () => null) {\n` +
      `  return condition ? local : remote;\n` +
      `}\n` +
      `export const ImportedFinalBranch = choose(Local, Remote);\n` +
      `function callbackOnly(candidate: () => null) {\n` +
      `  void candidate;\n` +
      `  return Remote;\n` +
      `}\n` +
      `export const UnrelatedOccurrence = callbackOnly(Local);\n`,
  );

  const compatibility = analyzeFrameworkCompatibility(analysis, { cwd: project.cwd });

  for (const exportName of [
    "Reexported",
    "Imported",
    "AliasedImport",
    "UnknownWrapper",
    "ImportedFinalBranch",
    "UnrelatedOccurrence",
  ]) {
    assert.equal(decisionFor(compatibility, exportName)?.outcome, "ineligible", exportName);
  }
  assert.equal(analysis.evaluationErrors.length, 0);
});

test("compatibility analyser requires every local wrapper return path to remain local [REQ-004, REQ-006]", (t) => {
  const project = createTemporaryProject(t);
  configureReactProject(project);
  project.writeFile("src/remote.ts", "export function Remote() { return null; }\n");
  const analysis = createAnalysis(
    project,
    "src/Wrappers.tsx",
    `import { Remote } from "./remote";\n` +
      `const Local = () => null;\n` +
      `function localOnly(Component: () => null) {\n` +
      `  if (condition) { return Component; }\n` +
      `  return Component;\n` +
      `}\n` +
      `function mayReturnImported(local: () => null, imported: () => null) {\n` +
      `  if (condition) { return local; }\n` +
      `  return imported;\n` +
      `}\n` +
      `export const LocalResult = localOnly(Local);\n` +
      `export const MixedResult = mayReturnImported(Local, Remote);\n`,
  );

  const compatibility = analyzeFrameworkCompatibility(analysis, { cwd: project.cwd });

  assert.equal(decisionFor(compatibility, "LocalResult")?.outcome, "eligible");
  assert.equal(decisionFor(compatibility, "MixedResult")?.outcome, "ineligible");
  assert.equal(analysis.evaluationErrors.length, 0);
});

test("compatibility analyser applies the configured JSX mode and rejects callable non-components [REQ-004, REQ-012]", async (t) => {
  for (const jsx of ["react", "react-jsx"]) {
    await t.test(jsx, (subtest) => {
      const project = createTemporaryProject(subtest);
      configureReactProject(project, jsx);
      const analysis = createAnalysis(
        project,
        "src/Components.tsx",
        `export const Component = () => null;\n` +
          `export const NotAComponent = () => 42;\n`,
      );

      const compatibility = analyzeFrameworkCompatibility(analysis, { cwd: project.cwd });

      assert.equal(decisionFor(compatibility, "Component")?.outcome, "eligible");
      assert.equal(decisionFor(compatibility, "NotAComponent")?.outcome, "ineligible");
      assert.equal(analysis.evaluationErrors.length, 0);
    });
  }
});

test("compatibility analyser does not require React JSX acceptance for a supported Next.js role [REQ-005, REQ-006]", (t) => {
  const project = createTemporaryProject(t);
  installNext(project, "16.2.0");
  project.writeFile(
    "tsconfig.json",
    JSON.stringify({ compilerOptions: { module: "CommonJS", moduleResolution: "Node" } }),
  );
  const analysis = createAnalysis(
    project,
    "app/page.tsx",
    "export default function Page() { return 42; }\n",
  );

  const compatibility = analyzeFrameworkCompatibility(analysis, { cwd: project.cwd });

  assert.equal(decisionFor(compatibility, "default")?.outcome, "eligible");
  assert.equal(decisionFor(compatibility, "default")?.frameworkRole, "app-page");
  assert.equal(analysis.evaluationErrors.length, 0);
});

test("compatibility analyser does not fall back to React for a resolved unsupported Next.js version [REQ-005, REQ-006]", (t) => {
  const project = createTemporaryProject(t);
  configureReactProject(project);
  installNext(project, "15.4.1");
  const analysis = createAnalysis(
    project,
    "src/Widget.tsx",
    "export default function Widget() { return null; }\n",
  );

  const compatibility = analyzeFrameworkCompatibility(analysis, { cwd: project.cwd });

  assert.equal(decisionFor(compatibility, "default")?.outcome, "ineligible");
  assert.equal(analysis.evaluationErrors.length, 0);
});

test("compatibility analyser records incomplete callability and unresolved React semantics [REQ-012]", async (t) => {
  await t.test("unresolved callable type", (subtest) => {
    const project = createTemporaryProject(subtest);
    configureReactProject(project);
    const analysis = createAnalysis(
      project,
      "src/Unknown.tsx",
      "export const Unknown: any = () => null;\n",
    );

    const compatibility = analyzeFrameworkCompatibility(analysis, { cwd: project.cwd });

    assert.equal(decisionFor(compatibility, "Unknown")?.outcome, "incomplete");
    assert.ok(analysis.evaluationErrors.some((error) => error.kind === "semantic-resolution"));
  });

  await t.test("missing React type package", (subtest) => {
    const project = createTemporaryProject(subtest);
    project.writeFile(
      "tsconfig.json",
      JSON.stringify({ compilerOptions: { jsx: "react", module: "CommonJS", moduleResolution: "Node" } }),
    );
    const analysis = createAnalysis(
      project,
      "src/Component.tsx",
      "export const Component = () => null;\n",
    );

    const compatibility = analyzeFrameworkCompatibility(analysis, { cwd: project.cwd });

    assert.equal(decisionFor(compatibility, "Component")?.outcome, "incomplete");
    assert.ok(analysis.evaluationErrors.some((error) => error.kind === "semantic-resolution"));
  });
});
