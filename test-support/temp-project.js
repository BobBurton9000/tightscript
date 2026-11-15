import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export function createTemporaryProject(testContext) {
  const cwd = mkdtempSync(join(tmpdir(), "tightscript-project-"));
  testContext.after(() => rmSync(cwd, { force: true, recursive: true }));

  return {
    cwd,
    writeFile(relativePath, contents) {
      const filePath = resolve(cwd, relativePath);
      const pathFromProject = relative(cwd, filePath);
      assert.ok(
        pathFromProject !== ".." &&
          !pathFromProject.startsWith(`..${sep}`) &&
          !isAbsolute(pathFromProject),
        "temporary-project files must stay inside the project directory",
      );
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, contents);
      return filePath;
    },
  };
}
