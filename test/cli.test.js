import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { runCli, runCliAsync } from "../test-support/run-cli.js";

const packagePath = fileURLToPath(new URL("../package.json", import.meta.url));
const packageMetadata = JSON.parse(readFileSync(packagePath, "utf8"));

test("package metadata declares the approved runtime and TypeScript API ranges", () => {
  assert.equal(packageMetadata.engines.node, "^24.0.0 || ^26.0.0");
  assert.equal(packageMetadata.peerDependencies.typescript, ">=5.9.0 <7.0.0");
  assert.equal(packageMetadata.bin.tightscript, "./bin/tightscript.js");
});

test("CLI fails with a source-scope configuration error when CWD config is missing", (t) => {
  const project = createTemporaryProject(t);
  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^FAIL: Source-scope configuration error:/);
  assert.ok(result.stderr.includes("tightscript.config.json"));
  assert.ok(result.stderr.includes(project.cwd));
});

test("CLI accepts a valid positive include configuration [REQ-008, REQ-039]", (t) => {
  const project = createTemporaryProject(t);
  project.writeFile(
    "tightscript.config.json",
    JSON.stringify({ include: ["src/**/*.ts", "src/**/*.tsx"] }),
  );
  const result = runCli(project.cwd);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.doesNotMatch(result.stderr, /^FAIL: Source-scope configuration error:/);
});

test("CLI init creates the default source scope [REQ-037]", (t) => {
  const project = createTemporaryProject(t);
  const result = runCli(project.cwd, ["init"]);

  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, "Created tightscript.config.json.\n");
  assert.deepEqual(
    JSON.parse(readFileSync(`${project.cwd}/tightscript.config.json`, "utf8")),
    { include: ["**/*.ts", "**/*.tsx"] },
  );
});

test("CLI init refuses to modify existing configuration [REQ-038]", async (t) => {
  const existingConfigurations = [
    ["valid configuration", JSON.stringify({ include: ["src/**/*.ts"] })],
    ["malformed configuration", '{"include":['],
  ];

  for (const [caseName, configurationContents] of existingConfigurations) {
    await t.test(caseName, (subtest) => {
      const project = createTemporaryProject(subtest);
      const configPath = project.writeFile(
        "tightscript.config.json",
        configurationContents,
      );
      const originalContents = readFileSync(configPath);
      const result = runCli(project.cwd, ["init"]);

      assert.ifError(result.error);
      assert.equal(result.signal, null);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /already exists; it was not modified/);
      assert.deepEqual(readFileSync(configPath), originalContents);
    });
  }
});

test("concurrent CLI init creates one configuration without replacement [REQ-037, REQ-038]", async (t) => {
  const project = createTemporaryProject(t);
  const results = await Promise.all([
    runCliAsync(project.cwd, ["init"]),
    runCliAsync(project.cwd, ["init"]),
  ]);

  assert.deepEqual(
    results.map((result) => result.status).sort(),
    [0, 1],
  );
  assert.ok(results.every((result) => result.signal === null));
  assert.ok(results.some((result) => result.stdout === "Created tightscript.config.json.\n"));
  assert.ok(results.some((result) => /already exists; it was not modified/.test(result.stderr)));
  assert.deepEqual(
    JSON.parse(readFileSync(`${project.cwd}/tightscript.config.json`, "utf8")),
    { include: ["**/*.ts", "**/*.tsx"] },
  );
});

test("CLI rejects invalid source-scope configurations [REQ-008, REQ-039]", async (t) => {
  const invalidConfigurations = [
    ["malformed JSON", '{"include":['],
    ["missing include", JSON.stringify({})],
    ["empty include", JSON.stringify({ include: [] })],
    ["unknown setting", JSON.stringify({ include: ["src/**/*.ts"], exclude: [] })],
    ["negated pattern", JSON.stringify({ include: ["!src/**/*.ts"] })],
    ["empty pattern", JSON.stringify({ include: ["   "] })],
  ];

  for (const [caseName, configurationContents] of invalidConfigurations) {
    await t.test(caseName, (subtest) => {
      const project = createTemporaryProject(subtest);
      project.writeFile("tightscript.config.json", configurationContents);
      const result = runCli(project.cwd);

      assert.ifError(result.error);
      assert.equal(result.signal, null);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /^FAIL: Source-scope configuration error:/);
      assert.doesNotMatch(result.stderr, /Evaluation error \[REQ-005\]/);
    });
  }
});
