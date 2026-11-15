import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

const PROPERTY_ID = "PROP-REQ-038-01";

function assertInitPreservesExistingConfiguration(testContext, contents) {
  const project = createTemporaryProject(testContext);
  const configPath = project.writeFile("tightscript.config.json", contents);
  const originalBytes = readFileSync(configPath);
  const result = runCli(project.cwd, ["init"]);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(
    result.stderr,
    /^FAIL: Initialization error: tightscript\.config\.json already exists; it was not modified\.\n$/,
  );
  assert.deepEqual(readFileSync(configPath), originalBytes);
}

test(`[${PROPERTY_ID}] init preserves an existing valid configuration`, (t) => {
  assertInitPreservesExistingConfiguration(
    t,
    JSON.stringify({ include: ["src/**/*.ts"] }),
  );
});

test(`[${PROPERTY_ID}] init preserves an existing malformed configuration`, (t) => {
  assertInitPreservesExistingConfiguration(t, '{"include":[');
});
