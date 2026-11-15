#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const CONFIG_FILENAME = "tightscript.config.json";

function configurationFromJson(contents) {
  let configuration;
  try {
    configuration = JSON.parse(contents);
  } catch (error) {
    throw new Error(`is not valid JSON: ${error.message}`);
  }

  const isConfigurationObject =
    typeof configuration === "object" &&
    configuration !== null &&
    !Array.isArray(configuration);
  if (!isConfigurationObject) {
    throw new Error("must contain a JSON object with an include array");
  }

  const unknownSettings = Object.keys(configuration).filter(
    (settingName) => settingName !== "include",
  );
  if (unknownSettings.length > 0) {
    throw new Error(
      `contains unsupported setting(s): ${unknownSettings.join(", ")}`,
    );
  }

  if (!Array.isArray(configuration.include) || configuration.include.length === 0) {
    throw new Error('must provide a non-empty "include" array');
  }

  for (const pattern of configuration.include) {
    if (typeof pattern !== "string" || pattern.trim().length === 0) {
      throw new Error('every "include" pattern must be a non-empty string');
    }
    if (pattern.startsWith("!")) {
      throw new Error('"include" patterns must not be negated');
    }
  }

  return configuration;
}

async function main() {
  const configPath = resolve(process.cwd(), CONFIG_FILENAME);
  let configurationContents;

  try {
    configurationContents = await readFile(configPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      process.stderr.write(
        `FAIL: Source-scope configuration error: ${CONFIG_FILENAME} was not found in the current working directory (${process.cwd()}).\n`,
      );
    } else {
      process.stderr.write(
        `FAIL: Evaluation error [REQ-005]: Could not read ${CONFIG_FILENAME}: ${error.message}\n`,
      );
    }
    process.exitCode = 1;
    return;
  }

  try {
    configurationFromJson(configurationContents);
  } catch (error) {
    process.stderr.write(
      `FAIL: Source-scope configuration error: ${CONFIG_FILENAME} ${error.message}.\n`,
    );
    process.exitCode = 1;
    return;
  }

  process.stderr.write(
    "FAIL: Evaluation error [REQ-005]: Tightscript policy evaluation is not implemented yet.\n",
  );
  process.exitCode = 1;
}

await main();
