import assert from "node:assert/strict";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

const PROPERTY_ID = "PROP-REQ-004-01";

function configureSourceScope(project) {
  project.writeFile(
    "tightscript.config.json",
    JSON.stringify({
      include: ["src/**/*.ts", "src/**/*.tsx", "app/**/*.ts", "app/**/*.tsx"],
    }),
  );
}

function configureReactTypes(project, jsx = "react-jsx") {
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
    `export namespace JSX {\n` +
      `  export interface Element { readonly __element?: unique symbol; }\n` +
      `  export interface IntrinsicElements { div: { id?: string }; }\n` +
      `}\n` +
      `export function createElement(...args: any[]): JSX.Element;\n` +
      `export function memo<T>(component: T): T;\n` +
      `export function forwardRef<T>(component: T): T;\n` +
      `export function unknownWrapper<T>(component: T): T;\n`,
  );
  project.writeFile(
    "node_modules/react/jsx-runtime.d.ts",
    `export namespace JSX {\n` +
      `  export interface Element { readonly __element?: unique symbol; }\n` +
      `  export interface IntrinsicElements { div: { id?: string }; }\n` +
      `}\n` +
      `export function jsx(type: any, props: any, key?: any): JSX.Element;\n` +
      `export function jsxs(type: any, props: any, key?: any): JSX.Element;\n` +
      `export const Fragment: {};\n`,
  );
}

function installNext(project, version) {
  project.writeFile(
    "node_modules/next/package.json",
    JSON.stringify({ name: "next", version, main: "index.js" }),
  );
  project.writeFile("node_modules/next/index.js", "module.exports = {};\n");
}

function assertCompletedCli(result) {
  assert.ifError(result.error);
  assert.equal(result.signal, null);
}

function assertFailedCli(result) {
  assertCompletedCli(result);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /\nFAIL\n$/);
}

function assertReq018For(result, exportName) {
  assert.match(
    result.stderr,
    new RegExp(
      `\\[REQ-018\\] Exported value "${exportName}" must not be callable\\.`,
    ),
    `expected REQ-018 for ${exportName}:\n${result.stderr}`,
  );
}

test(`[${PROPERTY_ID}] configured JSX modes accept components and reject non-components`, async (t) => {
  for (const jsx of ["react", "react-jsx"]) {
    await t.test(`[${PROPERTY_ID}] jsx=${jsx}`, (subtest) => {
      const project = createTemporaryProject(subtest);
      configureSourceScope(project);
      configureReactTypes(project, jsx);
      project.writeFile(
        "src/components.tsx",
        "export function ValidComponent() { return <div />; }\n" +
          "export function InvalidComponent() { return 42; }\n",
      );

      const result = runCli(project.cwd);

      assertFailedCli(result);
      assert.doesNotMatch(
        result.stderr,
        /Exported value "ValidComponent" must not be callable/,
      );
      assertReq018For(result, "InvalidComponent");
      assert.doesNotMatch(result.stderr, /\[REQ-005\]/);
    });
  }
});

test(`[${PROPERTY_ID}] missing or unresolved React types fail closed`, async (t) => {
  await t.test(`[${PROPERTY_ID}] missing React package`, (subtest) => {
    const project = createTemporaryProject(subtest);
    configureSourceScope(project);
    project.writeFile(
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: {
          jsx: "react-jsx",
          module: "CommonJS",
          moduleResolution: "Node",
        },
      }),
    );
    project.writeFile(
      "src/component.tsx",
      "export function Component() { return null; }\n",
    );

    const result = runCli(project.cwd);

    assertFailedCli(result);
    assert.match(result.stderr, /\[REQ-005\] Evaluation error:/);
    assertReq018For(result, "Component");
  });

  await t.test(`[${PROPERTY_ID}] unresolved React declaration entry`, (subtest) => {
    const project = createTemporaryProject(subtest);
    configureSourceScope(project);
    project.writeFile(
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: {
          jsx: "react-jsx",
          module: "CommonJS",
          moduleResolution: "Node",
        },
      }),
    );
    project.writeFile(
      "node_modules/react/package.json",
      JSON.stringify({ name: "react", version: "19.0.0", types: "missing.d.ts" }),
    );
    project.writeFile(
      "node_modules/react/jsx-runtime.d.ts",
      `export namespace JSX {\n` +
        `  export interface Element {}\n` +
        `  export interface IntrinsicElements { div: {}; }\n` +
        `}\n` +
        `export function jsx(type: any, props: any, key?: any): JSX.Element;\n` +
        `export function jsxs(type: any, props: any, key?: any): JSX.Element;\n`,
    );
    project.writeFile(
      "src/component.tsx",
      "export function Component() { return null; }\n",
    );

    const result = runCli(project.cwd);

    assertFailedCli(result);
    assert.match(result.stderr, /\[REQ-005\] Evaluation error:/);
    assertReq018For(result, "Component");
  });
});

test(`[${PROPERTY_ID}] direct and reviewed wrapped same-file implementations are eligible`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  configureReactTypes(project);
  project.writeFile(
    "src/components.tsx",
    `import { memo, forwardRef } from "react";\n` +
      `export function Direct() { return <div />; }\n` +
      `const Local = () => <div />;\n` +
      `export const LocalAlias = Local;\n` +
      `export const Memoized = memo(Local);\n` +
      `export const Forwarded = forwardRef(Local);\n` +
      `function localWrapper(component: typeof Local) { return component; }\n` +
      `export const LocallyWrapped = localWrapper(Local);\n`,
  );

  const result = runCli(project.cwd);

  assertCompletedCli(result);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});

test(`[${PROPERTY_ID}] imports, aliases, re-exports, unrelated occurrences, unknown wrappers, and imported final branches retain REQ-018`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  configureReactTypes(project);
  project.writeFile(
    "support/remote.tsx",
    "export function Remote() { return <div />; }\n",
  );
  project.writeFile(
    "src/exports.tsx",
    `import { Remote } from "../support/remote";\n` +
      `import { unknownWrapper } from "react";\n` +
      `const Local = () => <div />;\n` +
      `export const Imported = Remote;\n` +
      `const ImportedAlias = Remote;\n` +
      `export const ImportedAliasValue = ImportedAlias;\n` +
      `export { Remote as Reexported } from "../support/remote";\n` +
      `export const UnknownWrapper = unknownWrapper(Local);\n` +
      `function callbackOnly(candidate) {\n` +
      `  const callback = () => candidate;\n` +
      `  return Remote;\n` +
      `}\n` +
      `export const UnrelatedCallback = callbackOnly(Local);\n` +
      `function propertyOnly(candidate) {\n` +
      `  const holder = { component: candidate };\n` +
      `  return Remote;\n` +
      `}\n` +
      `export const UnrelatedProperty = propertyOnly(Local);\n` +
      `function chooseFinal(\n` +
      `  localCandidate: typeof Local,\n` +
      `  shouldUseLocal: boolean,\n` +
      `) {\n` +
      `  if (shouldUseLocal) { return localCandidate; }\n` +
      `  return Remote;\n` +
      `}\n` +
      `export const ImportedPossibleFinal = chooseFinal(Local, true);\n`,
  );

  const result = runCli(project.cwd);

  assertFailedCli(result);
  for (const exportName of [
    "Imported",
    "ImportedAliasValue",
    "Reexported",
    "UnknownWrapper",
    "UnrelatedCallback",
    "UnrelatedProperty",
    "ImportedPossibleFinal",
  ]) {
    assertReq018For(result, exportName);
  }
  assert.doesNotMatch(result.stderr, /\[REQ-005\]/);
});

test(`[${PROPERTY_ID}] a resolved Next.js project does not use React-only component eligibility`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  configureReactTypes(project);
  installNext(project, "16.2.0");
  project.writeFile(
    "src/ordinary-component.tsx",
    "export default function Component() { return <div />; }\n",
  );

  const result = runCli(project.cwd);

  assertFailedCli(result);
  assertReq018For(result, "default");
  assert.doesNotMatch(result.stderr, /\[REQ-005\]/);
});
