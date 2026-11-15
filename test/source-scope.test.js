import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createTemporaryProject } from "../test-support/temp-project.js";
import { resolveSourceFiles } from "../bin/source-scope.js";

const unsupportedSymlinkErrors = new Set([
  "EACCES",
  "ENOSYS",
  "ENOTSUP",
  "EOPNOTSUPP",
  "EPERM",
]);

function createDirectorySymlink(t, target, linkPath) {
  try {
    symlinkSync(target, linkPath, "dir");
    return true;
  } catch (error) {
    if (!unsupportedSymlinkErrors.has(error.code)) {
      throw error;
    }
    t.skip(`Directory symlink creation is unavailable (${error.code}).`);
    return false;
  }
}

test("source scope expands CWD-relative patterns and includes hidden and dependency directories", async (t) => {
  const project = createTemporaryProject(t);
  project.writeFile("src/index.ts", "export {};");
  project.writeFile("src/file1.ts", "export {};");
  project.writeFile("src/view.tsx", "export {};");
  project.writeFile("src/declaration.d.ts", "declare const value: string;");
  project.writeFile("src/not-source.js", "");
  project.writeFile("src/uppercase.TS", "");
  project.writeFile("src/map.tsx.map", "");
  project.writeFile(".hidden/config.ts", "export {};");
  project.writeFile("node_modules/example/index.ts", "export {};");

  const selected = await resolveSourceFiles(
    [
      "src/**/*.ts",
      "src/**/*.tsx",
      "src/file?.ts",
      ".hidden/**/*.ts",
      "node_modules/**/*.ts",
    ],
    project.cwd,
  );

  assert.deepEqual(
    selected.map((file) => file.displayPath),
    [
      ".hidden/config.ts",
      "node_modules/example/index.ts",
      "src/declaration.d.ts",
      "src/file1.ts",
      "src/index.ts",
      "src/view.tsx",
    ],
  );
});

test("source scope follows external directory symlinks and deduplicates aliases by final real path", async (t) => {
  const project = createTemporaryProject(t);
  const externalDirectory = mkdtempSync(join(tmpdir(), "tightscript-external-"));
  t.after(() => rmSync(externalDirectory, { force: true, recursive: true }));
  writeFileSync(join(externalDirectory, "shared.ts"), "export {};");

  if (
    !createDirectorySymlink(
      t,
      externalDirectory,
      join(project.cwd, "z-alias"),
    ) ||
    !createDirectorySymlink(
      t,
      externalDirectory,
      join(project.cwd, "a-external"),
    )
  ) {
    return;
  }

  const selected = await resolveSourceFiles(
    ["z-alias/**/*.ts", "a-external/**/*.ts"],
    project.cwd,
  );

  assert.equal(selected.length, 1);
  assert.equal(selected[0].displayPath, "a-external/shared.ts");
  assert.equal(selected[0].filePath, join(project.cwd, "a-external", "shared.ts"));
  assert.equal(selected[0].realPath, join(externalDirectory, "shared.ts"));
});

test("source scope stops directory-symlink cycles while continuing to select files", async (t) => {
  const project = createTemporaryProject(t);
  project.writeFile("src/actual.ts", "export {};");
  mkdirSync(join(project.cwd, "src", "nested"), { recursive: true });

  if (
    !createDirectorySymlink(
      t,
      project.cwd,
      join(project.cwd, "src", "nested", "cycle"),
    )
  ) {
    return;
  }

  const selected = await resolveSourceFiles(["**/*.ts"], project.cwd);
  assert.deepEqual(selected.map((file) => file.displayPath), ["src/actual.ts"]);
});

test("TypeScript project file lists do not alter selected source roots", async (t) => {
  const project = createTemporaryProject(t);
  project.writeFile("src/selected.ts", "export {};");
  project.writeFile("project-only/listed.ts", "export {};");
  project.writeFile(
    "tsconfig.json",
    JSON.stringify({
      files: ["project-only/listed.ts"],
      include: ["project-only/**/*.ts"],
      exclude: ["src/selected.ts"],
    }),
  );

  const selected = await resolveSourceFiles(["src/**/*.ts"], project.cwd);
  assert.deepEqual(selected.map((file) => file.displayPath), ["src/selected.ts"]);
});
