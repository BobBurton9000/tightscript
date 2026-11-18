import assert from "node:assert/strict";
import { existsSync, readFileSync, symlinkSync } from "node:fs";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

const PROPERTY_ID = "PROP-REQ-006-01";
const FRAMEWORK_SOURCE_SCOPE_PROPERTY_ID = "PROP-REQ-001-01";
const UNSUPPORTED_SYMLINK_ERRORS = new Set([
  "EACCES",
  "ENOSYS",
  "ENOTSUP",
  "EOPNOTSUPP",
  "EPERM",
]);

function configureSourceScope(project, cwd, patterns) {
  project.writeFile(
    `${cwd}/tightscript.config.json`,
    JSON.stringify({ include: patterns }),
  );
}

function diagnosticPaths(result) {
  return result.stderr
    .split("\n")
    .filter((line) => /^\S+:\d+:\d+ \[REQ-\d{3}\] /u.test(line))
    .map((line) => {
      const match = line.match(/^(.*):\d+:\d+ \[(REQ-\d{3})\] /u);
      assert.ok(match, `Expected a located diagnostic: ${line}`);
      return { filePath: match[1], requirementId: match[2] };
    });
}

function assertFailedCheck(result) {
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /\nFAIL\n$/u);
}

function createDirectorySymlink(testContext, target, linkPath) {
  try {
    symlinkSync(target, linkPath, "dir");
    return true;
  } catch (error) {
    if (!UNSUPPORTED_SYMLINK_ERRORS.has(error.code)) {
      throw error;
    }
    testContext.skip(`Directory symlink creation is unavailable (${error.code}).`);
    return false;
  }
}

function configureReactTypes(project) {
  project.writeFile(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        jsx: "react-jsx",
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
      `export function createElement(...args: any[]): JSX.Element;\n`,
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

function installNext(project, version = "16.2.0") {
  project.writeFile(
    "node_modules/next/package.json",
    JSON.stringify({ name: "next", version, main: "index.js" }),
  );
  project.writeFile("node_modules/next/index.js", "module.exports = {};\n");
}

test(`[${FRAMEWORK_SOURCE_SCOPE_PROPERTY_ID}] React compatibility keeps policy roots within positive authored TypeScript includes`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project, project.cwd, ["src/**/*.ts", "src/**/*.tsx"]);
  configureReactTypes(project);
  project.writeFile(
    "src/Component.tsx",
    "export function Component() { return <div />; }\n" +
      "let selectedTsx = 1;\n",
  );
  project.writeFile("src/selected.ts", "let selectedTypeScript = 1;\n");
  project.writeFile("outside/OutOfPattern.ts", "let outOfPattern = 1;\n");
  project.writeFile("generated/Generated.ts", "let generated = 1;\n");
  project.writeFile(
    "node_modules/third-party/index.ts",
    "let dependency = 1;\n",
  );
  project.writeFile("src/legacy.js", "let legacyJavaScript = 1;\n");
  project.writeFile("src/legacy.jsx", "let legacyJsx = 1;\n");

  const result = runCli(project.cwd);

  assertFailedCheck(result);
  assert.deepEqual(diagnosticPaths(result), [
    { filePath: "src/Component.tsx", requirementId: "REQ-009" },
    { filePath: "src/selected.ts", requirementId: "REQ-009" },
  ]);
  assert.doesNotMatch(result.stderr, /Exported value "Component" must not be callable/u);
  assert.doesNotMatch(result.stderr, /__tightscript_compatibility_probe__/u);
  assert.equal(
    existsSync(`${project.cwd}/__tightscript_compatibility_probe__.tsx`),
    false,
  );
});

test(`[${FRAMEWORK_SOURCE_SCOPE_PROPERTY_ID}] Next.js compatibility does not add convention, generated, dependency, or JavaScript paths as policy roots`, (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project, project.cwd, ["src/**/*.ts", "src/**/*.tsx"]);
  installNext(project);
  project.writeFile(
    "src/ordinary.ts",
    "let selectedTypeScript = 1;\n" +
      "export function OrdinaryCallable() { return 1; }\n",
  );
  project.writeFile(
    "app/page.tsx",
    "let excludedRoute = 1;\n" +
      "export default function Page() { return 42; }\n",
  );
  project.writeFile("generated/Generated.ts", "let generated = 1;\n");
  project.writeFile(
    "node_modules/third-party/index.ts",
    "let dependency = 1;\n",
  );
  project.writeFile("src/legacy.js", "let legacyJavaScript = 1;\n");
  project.writeFile("src/legacy.jsx", "let legacyJsx = 1;\n");

  const result = runCli(project.cwd);

  assertFailedCheck(result);
  assert.deepEqual(diagnosticPaths(result), [
    { filePath: "src/ordinary.ts", requirementId: "REQ-009" },
    { filePath: "src/ordinary.ts", requirementId: "REQ-018" },
  ]);
  assert.doesNotMatch(result.stderr, /\bapp\/page\.tsx:/u);
  assert.doesNotMatch(result.stderr, /__tightscript_compatibility_probe__/u);
});

test(`[${FRAMEWORK_SOURCE_SCOPE_PROPERTY_ID}] framework presence leaves init defaults and TypeScript-only selection unchanged`, (t) => {
  const project = createTemporaryProject(t);
  installNext(project);
  project.writeFile("src/Scope.ts", "let selectedTypeScript = 1;\n");
  project.writeFile("src/Scope.tsx", "let selectedTsx = 1;\n");
  project.writeFile("src/legacy.js", "let legacyJavaScript = 1;\n");
  project.writeFile("src/legacy.jsx", "let legacyJsx = 1;\n");

  const initResult = runCli(project.cwd, ["init"]);

  assert.ifError(initResult.error);
  assert.equal(initResult.signal, null);
  assert.equal(initResult.status, 0);
  assert.equal(initResult.stderr, "");
  assert.equal(initResult.stdout, "Created tightscript.config.json.\n");
  assert.deepEqual(
    JSON.parse(readFileSync(`${project.cwd}/tightscript.config.json`, "utf8")),
    { include: ["**/*.ts", "**/*.tsx"] },
  );

  const result = runCli(project.cwd);

  assertFailedCheck(result);
  assert.deepEqual(diagnosticPaths(result), [
    { filePath: "src/Scope.ts", requirementId: "REQ-009" },
    { filePath: "src/Scope.tsx", requirementId: "REQ-009" },
  ]);
});

test(`[${PROPERTY_ID}] include patterns are relative to each invocation CWD and inspect every matching .ts and .tsx file`, (t) => {
  const project = createTemporaryProject(t);
  const patterns = ["src/**/*.ts", "src/**/*.tsx"];
  configureSourceScope(project, ".", patterns);
  configureSourceScope(project, "nested", patterns);

  project.writeFile("src/Root.ts", "let rootValue = 1;\n");
  project.writeFile("src/nested/Child.tsx", "if (true) {} else {}\n");
  project.writeFile("other/RootControl.ts", "let rootControl = 1;\n");
  project.writeFile("nested/src/Nested.tsx", "let nestedValue = 1;\n");
  project.writeFile("nested/src/deep/Leaf.ts", "if (true) {} else {}\n");
  project.writeFile("nested/other/NestedControl.ts", "let nestedControl = 1;\n");

  const rootResult = runCli(project.cwd);
  assertFailedCheck(rootResult);
  assert.deepEqual(diagnosticPaths(rootResult), [
    { filePath: "src/Root.ts", requirementId: "REQ-009" },
    { filePath: "src/nested/Child.tsx", requirementId: "REQ-032" },
  ]);

  const nestedResult = runCli(`${project.cwd}/nested`);
  assertFailedCheck(nestedResult);
  assert.deepEqual(diagnosticPaths(nestedResult), [
    { filePath: "src/Nested.tsx", requirementId: "REQ-009" },
    { filePath: "src/deep/Leaf.ts", requirementId: "REQ-032" },
  ]);
});

test(`[${PROPERTY_ID}] matching aliases for one physical file report the first sorted path`, (t) => {
  const project = createTemporaryProject(t);
  const physicalDirectory = `${project.cwd}/physical`;
  project.writeFile("physical/Shared.ts", "let sharedValue = 1;\n");
  configureSourceScope(project, ".", ["z-alias/**/*.ts", "a-alias/**/*.ts"]);

  if (
    !createDirectorySymlink(
      t,
      physicalDirectory,
      `${project.cwd}/z-alias`,
    ) ||
    !createDirectorySymlink(
      t,
      physicalDirectory,
      `${project.cwd}/a-alias`,
    )
  ) {
    return;
  }

  const result = runCli(project.cwd);

  assertFailedCheck(result);
  assert.equal(
    result.stderr,
    "a-alias/Shared.ts:1:1 [REQ-009] `let` declarations are not permitted.\nFAIL\n",
  );
});
