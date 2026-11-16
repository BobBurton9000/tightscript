#!/usr/bin/env node

import { open, readFile, unlink } from "node:fs/promises";
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

async function initializeConfiguration() {
  const configPath = resolve(process.cwd(), CONFIG_FILENAME);
  const configurationContents = `${JSON.stringify(
    { include: ["**/*.ts", "**/*.tsx"] },
    null,
    2,
  )}\n`;
  let configurationHandle;

  try {
    configurationHandle = await open(configPath, "wx");
  } catch (error) {
    if (error.code === "EEXIST") {
      process.stderr.write(
        `FAIL: Initialization error: ${CONFIG_FILENAME} already exists; it was not modified.\n`,
      );
    } else {
      process.stderr.write(
        `FAIL: Initialization error: Could not create ${CONFIG_FILENAME}: ${error.message}\n`,
      );
    }
    process.exitCode = 1;
    return;
  }

  let initializationError;
  try {
    await configurationHandle.writeFile(configurationContents, "utf8");
  } catch (error) {
    initializationError = error;
  }

  try {
    await configurationHandle.close();
  } catch (error) {
    initializationError ??= error;
  }

  if (initializationError !== undefined) {
    let cleanupError;
    try {
      await unlink(configPath);
    } catch (error) {
      cleanupError = error;
    }
    const cleanupMessage =
      cleanupError === undefined || cleanupError.code === "ENOENT"
        ? ""
        : ` Could not remove the partial file: ${cleanupError.message}.`;
    process.stderr.write(
      `FAIL: Initialization error: Could not write ${CONFIG_FILENAME}: ${initializationError.message}.${cleanupMessage}\n`,
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`Created ${CONFIG_FILENAME}.\n`);
}

async function main() {
  if (process.argv[2] === "init") {
    await initializeConfiguration();
    return;
  }

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

  let configuration;
  try {
    configuration = configurationFromJson(configurationContents);
  } catch (error) {
    process.stderr.write(
      `FAIL: Source-scope configuration error: ${CONFIG_FILENAME} ${error.message}.\n`,
    );
    process.exitCode = 1;
    return;
  }

  const evaluationErrors = [];
  let selectedFiles = [];
  try {
    const { resolveSourceFiles } = await import("./source-scope.js");
    selectedFiles = await resolveSourceFiles(configuration.include);
  } catch (error) {
    evaluationErrors.push({
      message: `Could not resolve source files: ${error.message}`,
    });
  }

  let policyViolations = [];
  if (evaluationErrors.length === 0) {
    try {
      const [
        { findCommentViolations },
        { createTypeScriptAnalysis },
        { findLetDeclarationViolations },
        { findFileStructureViolations },
        { findExportViolations },
        { findImportedValueViolations },
        { findPrivateInstanceStateViolations },
        { findInterfaceViolations },
        { findTypeAnnotationViolations },
        { findTypeAliasAndUnionViolations },
        { findSyntaxStyleViolations },
        { findRepeatedStringViolations },
      ] = await Promise.all([
        import("./comment-validator.js"),
        import("./typescript-analysis.js"),
        import("./let-declaration-validator.js"),
        import("./file-structure-validator.js"),
        import("./export-validator.js"),
        import("./imported-value-validator.js"),
        import("./private-state-validator.js"),
        import("./interface-validator.js"),
        import("./type-annotation-validator.js"),
        import("./type-alias-union-validator.js"),
        import("./syntax-style-validator.js"),
        import("./repeated-string-validator.js"),
      ]);
      const analysis = createTypeScriptAnalysis(selectedFiles);
      try {
        policyViolations = [
          ...findLetDeclarationViolations(analysis.sourceFiles),
          ...findFileStructureViolations(analysis.sourceFiles),
          ...findExportViolations(analysis),
          ...findImportedValueViolations(analysis),
          ...findPrivateInstanceStateViolations(analysis.sourceFiles),
          ...findInterfaceViolations(analysis),
          ...findTypeAnnotationViolations(analysis.sourceFiles),
          ...findTypeAliasAndUnionViolations(analysis.sourceFiles),
          ...findSyntaxStyleViolations(analysis),
          ...findCommentViolations(analysis),
          ...findRepeatedStringViolations(analysis),
        ];
      } finally {
        evaluationErrors.push(...analysis.evaluationErrors);
      }
    } catch (error) {
      evaluationErrors.push({
        message: `Could not complete policy evaluation: ${error.message}`,
      });
    }
  }

  const diagnostics = [
    ...policyViolations,
    ...evaluationErrors.map((error) => ({
      ...error,
      requirementId: "REQ-005",
      message: `Evaluation error: ${error.message}`,
    })),
  ];
  diagnostics.sort((left, right) => {
    const leftLocation = [
      left.filePath ?? "",
      left.line ?? 0,
      left.column ?? 0,
      left.requirementId,
      left.message,
    ];
    const rightLocation = [
      right.filePath ?? "",
      right.line ?? 0,
      right.column ?? 0,
      right.requirementId,
      right.message,
    ];
    for (let index = 0; index < leftLocation.length; index += 1) {
      if (leftLocation[index] < rightLocation[index]) return -1;
      if (leftLocation[index] > rightLocation[index]) return 1;
    }
    return 0;
  });

  if (diagnostics.length === 0) {
    process.stdout.write("PASS\n");
    return;
  }

  for (const diagnostic of diagnostics) {
    const location =
      diagnostic.filePath === undefined
        ? ""
        : diagnostic.line === undefined
          ? `${diagnostic.filePath} `
          : `${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column} `;
    process.stderr.write(
      `${location}[${diagnostic.requirementId}] ${diagnostic.message}\n`,
    );
  }
  process.stderr.write("FAIL\n");
  process.exitCode = 1;
}

await main();
