import assert from "node:assert/strict";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

function configureSourceScope(project) {
  project.writeFile(
    "tightscript.config.json",
    JSON.stringify({
      include: [
        "src/**/*.ts",
        "src/**/*.tsx",
        "app/**/*.ts",
        "app/**/*.tsx",
      ],
    }),
  );
}

function configurePagesSourceScope(project) {
  project.writeFile(
    "tightscript.config.json",
    JSON.stringify({ include: ["pages/**/*.ts", "pages/**/*.tsx"] }),
  );
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

function installNext(project, version) {
  project.writeFile(
    "node_modules/next/package.json",
    JSON.stringify({ name: "next", version, main: "index.js" }),
  );
  project.writeFile("node_modules/next/index.js", "module.exports = {};\n");
}

test("real CLI exempts a local React component accepted by configured JSX semantics [REQ-004, REQ-018]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  configureReactTypes(project);
  project.writeFile(
    "src/Component.tsx",
    "export default function Component() { return <div />; }\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});

test("real CLI retains REQ-018 for a local callable rejected as a JSX component [REQ-004, REQ-011, REQ-018]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  configureReactTypes(project);
  project.writeFile(
    "src/NotAComponent.tsx",
    "export function NotAComponent() { return 42; }\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(
    result.stderr,
    /\[REQ-018\] Exported value "NotAComponent" must not be callable\./,
  );
  assert.doesNotMatch(result.stderr, /\[REQ-005\]/);
  assert.match(result.stderr, /\nFAIL\n$/);
});

test("real CLI exempts a checker-callable local export in a supported Next.js convention [REQ-005, REQ-018]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  installNext(project, "16.2.0");
  project.writeFile(
    "app/page.tsx",
    "export default function Page() { return 42; }\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});

test("real CLI fails closed when required React JSX semantics are incomplete [REQ-005, REQ-012, REQ-018]", (t) => {
  const project = createTemporaryProject(t);
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
    "src/Component.tsx",
    "export function Component() { return null; }\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /\[REQ-005\] Evaluation error:/);
  assert.match(
    result.stderr,
    /\[REQ-018\] Exported value "Component" must not be callable\./,
  );
  assert.match(result.stderr, /\nFAIL\n$/);
});

test("eligible compatibility does not suppress independent local export-list policy [REQ-004, REQ-007, REQ-018, REQ-020]", (t) => {
  const project = createTemporaryProject(t);
  configureSourceScope(project);
  configureReactTypes(project);
  project.writeFile(
    "src/Component.tsx",
    "function Component() { return <div />; }\nexport { Component };\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(
    result.stderr,
    /\[REQ-020\] Local value "Component" must be exported inline/,
  );
  assert.doesNotMatch(result.stderr, /\[REQ-018\]/);
  assert.match(result.stderr, /\nFAIL\n$/);
});

test("real CLI exempts exact local Pages Router data exports from REQ-031 [REQ-005, REQ-009]", (t) => {
  const project = createTemporaryProject(t);
  configurePagesSourceScope(project);
  installNext(project, "16.2.0");
  project.writeFile(
    "pages/index.ts",
    "export function getStaticProps() { return undefined; }\n" +
      "export const getStaticPaths = () => undefined;\n" +
      "export const getServerSideProps = function () { return undefined; };\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});

test("real CLI retains REQ-031 outside exact local Pages Router slots [REQ-005, REQ-009, REQ-010]", (t) => {
  const project = createTemporaryProject(t);
  configurePagesSourceScope(project);
  installNext(project, "16.2.0");
  project.writeFile(
    "support/remote.ts",
    "export function remoteData() { return undefined; }\n",
  );
  project.writeFile(
    "pages/index.ts",
    "export function getStaticProps() { return undefined; }\n" +
      "function getMetadata() { return undefined; }\n" +
      "const getLocal = () => undefined;\n" +
      "class Store { getItem() { return undefined; } }\n",
  );
  project.writeFile(
    "pages/alias.ts",
    "const getPageData = () => undefined;\n" +
      "export { getPageData as getStaticProps };\n",
  );
  project.writeFile(
    "pages/imported.ts",
    "import { remoteData } from \"../support/remote\";\n" +
      "export const getStaticProps = remoteData;\n",
  );
  project.writeFile(
    "pages/api/getStaticProps.ts",
    "export function getStaticProps() { return undefined; }\n",
  );
  project.writeFile(
    "pages/_app.ts",
    "export function getStaticProps() { return undefined; }\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  const namingDiagnostics = result.stderr
    .split("\n")
    .filter((line) => line.includes("[REQ-031]"));
  assert.equal(namingDiagnostics.length, 7, result.stderr);
  for (const [file, name] of [
    ["pages/alias.ts", "getPageData"],
    ["pages/imported.ts", "getStaticProps"],
    ["pages/api/getStaticProps.ts", "getStaticProps"],
    ["pages/_app.ts", "getStaticProps"],
    ["pages/index.ts", "getMetadata"],
    ["pages/index.ts", "getLocal"],
    ["pages/index.ts", "getItem"],
  ]) {
    assert.ok(
      namingDiagnostics.some(
        (line) =>
          line.startsWith(`${file}:`) && line.includes(`name "${name}"`),
      ),
      `missing REQ-031 for ${file} ${name}:\n${result.stderr}`,
    );
  }
  assert.doesNotMatch(result.stderr, /pages\/index\.ts:1:\d+ \[REQ-031\]/);
  assert.match(result.stderr, /\nFAIL\n$/);
});

test("real CLI keeps REQ-031 for Pages data exports on unsupported Next.js versions [REQ-005, REQ-009, REQ-010]", (t) => {
  const project = createTemporaryProject(t);
  configurePagesSourceScope(project);
  installNext(project, "15.4.1");
  project.writeFile(
    "pages/index.ts",
    "export function getStaticProps() { return undefined; }\n",
  );

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /pages\/index\.ts:1:\d+ \[REQ-031\]/);
  assert.match(result.stderr, /\[REQ-018\] Exported value "getStaticProps"/);
  assert.match(result.stderr, /\nFAIL\n$/);
});
