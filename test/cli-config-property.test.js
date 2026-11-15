import assert from "node:assert/strict";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli } from "../test-support/run-cli.js";

const PROPERTY_ID = "PROP-REQ-008-01";

const prohibitedSettings = [
  {
    name: "rule selection or configuration",
    settingName: "rules",
    setting: { rules: { "REQ-009": false } },
  },
  {
    name: "policy threshold changes",
    settingName: "thresholds",
    setting: { thresholds: { repeatedStrings: { minimumOccurrences: 4 } } },
  },
  {
    name: "individual file exclusions",
    settingName: "exclude",
    setting: { exclude: ["src/Violation.ts"] },
  },
  {
    name: "per-file policy exceptions",
    settingName: "overrides",
    setting: {
      overrides: { "src/Violation.ts": { rules: { "REQ-009": "off" } } },
    },
  },
  {
    name: "violation suppressions",
    settingName: "suppressions",
    setting: { suppressions: [{ file: "src/Violation.ts", rule: "REQ-009" }] },
  },
];

test(`[${PROPERTY_ID}] prohibited policy weakening settings are rejected`, async (t) => {
  for (const scenario of prohibitedSettings) {
    await t.test(`[${PROPERTY_ID}] rejects ${scenario.name}`, (subtest) => {
      const project = createTemporaryProject(subtest);
      project.writeFile(
        "tightscript.config.json",
        JSON.stringify({ include: ["src/**/*.ts"], ...scenario.setting }),
      );
      project.writeFile("src/Violation.ts", "let forbiddenValue = 1;\n");

      const result = runCli(project.cwd);

      assert.ifError(result.error);
      assert.equal(result.signal, null);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.equal(
        result.stderr,
        `FAIL: Source-scope configuration error: tightscript.config.json contains unsupported setting(s): ${scenario.settingName}.\n`,
      );
    });
  }
});

test(`[${PROPERTY_ID}] positive include selection remains usable without weakening policy`, (t) => {
  const project = createTemporaryProject(t);
  project.writeFile(
    "tightscript.config.json",
    JSON.stringify({ include: ["selected/**/*.ts"] }),
  );
  project.writeFile("selected/Violation.ts", "let forbiddenValue = 1;\n");
  project.writeFile("unselected/Control.ts", "let controlValue = 1;\n");

  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "selected/Violation.ts:1:1 [REQ-009] `let` declarations are not permitted.\nFAIL\n",
  );
});
