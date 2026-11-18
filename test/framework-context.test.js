import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { resolveFrameworkContext } from "../bin/framework-context.js";
import { createTemporaryProject } from "../test-support/temp-project.js";

function installNext(project, version, entryContents = "module.exports = {};\n") {
  project.writeFile(
    "node_modules/next/package.json",
    JSON.stringify({ name: "next", version, main: "index.js" }),
  );
  project.writeFile("node_modules/next/index.js", entryContents);
}

test("framework context treats an unresolved Next.js package as absent [REQ-005, REQ-006]", (t) => {
  const project = createTemporaryProject(t);

  const context = resolveFrameworkContext(project.cwd);

  assert.deepEqual(context.next, { status: "absent" });
});

test("framework context distinguishes supported and unsupported resolved versions [REQ-005, REQ-006]", async (t) => {
  for (const scenario of [
    { version: "16.2.3", status: "supported", major: 16 },
    { version: "15.4.1", status: "unsupported", major: 15 },
  ]) {
    await t.test(scenario.version, (subtest) => {
      const project = createTemporaryProject(subtest);
      const moduleMarker = resolve(project.cwd, "next-module-loaded");
      installNext(
        project,
        scenario.version,
        `require("node:fs").writeFileSync(${JSON.stringify(moduleMarker)}, "loaded");\n`,
      );

      const context = resolveFrameworkContext(project.cwd);

      assert.equal(context.next.status, scenario.status);
      assert.equal(context.next.version, scenario.version);
      assert.equal(context.next.major, scenario.major);
      assert.equal(context.next.packageRoot, resolve(project.cwd, "node_modules/next"));
      assert.equal(
        context.routingConfiguration.status,
        "default",
        "an absent Next.js config preserves default routing configuration",
      );
      assert.equal(
        projectPathExists(project.cwd, "next-module-loaded"),
        false,
        "resolving Next.js must not load its entry module",
      );
    });
  }
});

function projectPathExists(cwd, relativePath) {
  return existsSync(resolve(cwd, relativePath));
}

test("framework context fails closed when resolved Next.js metadata is unreadable [REQ-005, REQ-006, REQ-012]", (t) => {
  const project = createTemporaryProject(t);
  installNext(project, "16.1.0");
  const metadataPath = resolve(project.cwd, "node_modules/next/package.json");

  const context = resolveFrameworkContext(project.cwd, {
    readTextFile(filePath) {
      if (resolve(filePath) === metadataPath) {
        throw new Error("EACCES: metadata is unreadable");
      }
      return readFileSync(filePath, "utf8");
    },
  });

  assert.equal(context.next.status, "indeterminate");
  assert.equal(context.next.version, undefined);

  const malformedMetadataContext = resolveFrameworkContext(project.cwd, {
    readTextFile(filePath) {
      if (resolve(filePath) === metadataPath) {
        return "null";
      }
      return readFileSync(filePath, "utf8");
    },
  });
  assert.equal(malformedMetadataContext.next.status, "indeterminate");
  assert.equal(context.routingConfiguration.status, "default");
});

test("routing configuration defaults when absent or statically unchanged [REQ-005, REQ-006, REQ-012]", (t) => {
  const project = createTemporaryProject(t);

  assert.deepEqual(
    resolveFrameworkContext(project.cwd).routingConfiguration,
    { status: "default" },
  );

  project.writeFile(
    "next.config.ts",
    `const defaultExtensions = ["tsx", "ts", "jsx", "js"] as const;\n` +
      `export default { pageExtensions: defaultExtensions };\n`,
  );

  assert.deepEqual(
    resolveFrameworkContext(project.cwd).routingConfiguration,
    { status: "default" },
  );
});

test("routing configuration marks custom pageExtensions as changed [REQ-005, REQ-006]", (t) => {
  const project = createTemporaryProject(t);
  project.writeFile(
    "next.config.js",
    `module.exports = { pageExtensions: ["page.tsx", "page.ts"] };\n`,
  );

  const context = resolveFrameworkContext(project.cwd);

  assert.deepEqual(context.routingConfiguration, { status: "changed" });
});

test("dynamic routing configuration is indeterminate and is never executed [REQ-005, REQ-006, REQ-012]", (t) => {
  const project = createTemporaryProject(t);
  const markerPath = resolve(project.cwd, "configuration-executed");
  project.writeFile(
    "next.config.cjs",
    `module.exports = { pageExtensions: (() => {\n` +
      `  require("node:fs").writeFileSync(${JSON.stringify(markerPath)}, "executed");\n` +
      `  return ["tsx", "ts"];\n` +
      `})() };\n`,
  );

  const context = resolveFrameworkContext(project.cwd);

  assert.deepEqual(context.routingConfiguration, { status: "indeterminate" });
  assert.equal(projectPathExists(project.cwd, "configuration-executed"), false);
});
