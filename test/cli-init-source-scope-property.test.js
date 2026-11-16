import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

const PROPERTY_ID = "PROP-REQ-037-01";
const DEFAULT_INCLUDE = ["**/*.ts", "**/*.tsx"];

function initializeProject(project) {
  const result = runCli(project.cwd, ["init"]);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, "Created tightscript.config.json.\n");

  const configuration = JSON.parse(
    readFileSync(`${project.cwd}/tightscript.config.json`, "utf8"),
  );
  assert.deepEqual(configuration, { include: DEFAULT_INCLUDE });
  return configuration;
}

test(`[${PROPERTY_ID}] init scope selects root and nested .ts and .tsx violations`, (t) => {
  const project = createTemporaryProject(t);
  const violations = [
    ["Root.ts", "let rootTypeScript = 1;\n"],
    ["RootView.tsx", "let rootTsx = 1;\n"],
    ["nested/Nested.ts", "let nestedTypeScript = 1;\n"],
    ["nested/NestedView.tsx", "let nestedTsx = 1;\n"],
  ];
  for (const [path, contents] of violations) {
    project.writeFile(path, contents);
  }

  initializeProject(project);

  const result = runCli(project.cwd);
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    `${violations
      .map(([path]) => `${path}:1:1 [REQ-009] \`let\` declarations are not permitted.`)
      .join("\n")}\nFAIL\n`,
  );
});

test(`[${PROPERTY_ID}] init keeps a non-empty source scope when no TypeScript files exist`, (t) => {
  const project = createTemporaryProject(t);
  const configuration = initializeProject(project);

  assert.deepEqual(configuration.include, DEFAULT_INCLUDE);
  assert.ok(configuration.include.length > 0);

  const result = runCli(project.cwd);
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "PASS\n");
  assert.equal(result.stderr, "");
});
