#!/usr/bin/env node

import { access } from "node:fs/promises";
import { resolve } from "node:path";

const CONFIG_FILENAME = "tightscript.config.json";

async function main() {
  const configPath = resolve(process.cwd(), CONFIG_FILENAME);

  try {
    await access(configPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      process.stderr.write(
        `FAIL: Source-scope configuration error: ${CONFIG_FILENAME} was not found in the current working directory (${process.cwd()}).\n`,
      );
    } else {
      process.stderr.write(
        `FAIL: Evaluation error [REQ-005]: Could not access ${CONFIG_FILENAME}: ${error.message}\n`,
      );
    }
    process.exitCode = 1;
    return;
  }

  process.stderr.write(
    "FAIL: Evaluation error [REQ-005]: Tightscript policy evaluation is not implemented yet.\n",
  );
  process.exitCode = 1;
}

await main();
