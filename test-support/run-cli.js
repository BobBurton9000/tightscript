import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../bin/tightscript.js", import.meta.url));

export function runCli(cwd, args = []) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

export function runCliAsync(cwd, args = []) {
  const childProcess = spawn(process.execPath, [cliPath, ...args], { cwd });
  let stdout = "";
  let stderr = "";
  childProcess.stdout.setEncoding("utf8");
  childProcess.stderr.setEncoding("utf8");
  childProcess.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  childProcess.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  return new Promise((resolve, reject) => {
    childProcess.once("error", reject);
    childProcess.once("close", (status, signal) => {
      resolve({ status, signal, stdout, stderr, error: null });
    });
  });
}
