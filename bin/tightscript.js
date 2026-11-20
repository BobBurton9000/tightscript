#!/usr/bin/env node

import { open, readFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";

const CONFIG_FILENAME = "tightscript.config.json";

// @see [Tightscript: config parsing rejects settings that could weaken the fixed policy.](./configuration.md#tightscript-req-008)
// @see [Tightscript: config parsing rejects absent or empty include settings.](./configuration.md#tightscript-req-039)
// @see [Tightscript: config parsing rejects every policy-weakening setting.](./configuration.md#tightscript-prop-req-008-01)
// @see [nextjs-client-directive-exemption: This parser rejects configurable directive exceptions and rule switches.](./repeated-strings.md#nextjs-client-directive-exemption-req-006)
// @see [nextjs-client-directive-exemption: This parser prevents settings from changing the fixed directive-eligibility boundary.](./repeated-strings.md#nextjs-client-directive-exemption-prop-req-001-01)
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

// @see [Tightscript: init writes default recursive patterns for `.ts` and `.tsx` files.](./configuration.md#tightscript-req-037)
// @see [Tightscript: init creates the config exclusively and refuses to replace an existing file.](./configuration.md#tightscript-req-038)
// @see [Tightscript: init creates a non-empty default scope for TypeScript sources.](./configuration.md#tightscript-prop-req-037-01)
// @see [Tightscript: exclusive creation preserves any existing configuration unchanged.](./configuration.md#tightscript-prop-req-038-01)
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

// @see [Tightscript: the CLI maps completed checks to a result and matching exit status.](./command-outcomes.md#tightscript-req-001)
// @see [Tightscript: the CLI passes a complete clean check, including an empty selection.](./command-outcomes.md#tightscript-req-002)
// @see [Tightscript: the CLI fails when policy findings exist.](./command-outcomes.md#tightscript-req-003)
// @see [Tightscript: the CLI prints findings with their file, source location, and requirement ID.](./diagnostics.md#tightscript-req-004)
// @see [Tightscript: the CLI turns evaluation errors into failed, nonzero checks.](./command-outcomes.md#tightscript-req-005)
// @see [Tightscript: the CLI fails when config or a non-empty CWD scope is missing.](./configuration.md#tightscript-req-039)
// @see [Tightscript: the CLI reports PASS only after complete evaluation with no violations.](./command-outcomes.md#tightscript-prop-req-001-01)
// @see [Tightscript: the CLI renders each finding with its source and rule identity.](./diagnostics.md#tightscript-prop-req-004-01)
// @see [react-next-compatibility: the CLI passes only configured include patterns into source resolution.](./framework-compatibility.md#react-next-compatibility-req-002)
// @see [react-next-compatibility: the CLI runs framework compatibility without disabling unrelated Tightscript policies.](./framework-compatibility.md#react-next-compatibility-req-003)
// @see [react-next-compatibility: the CLI evaluates export-list and imported-value policies independently of framework eligibility.](./framework-compatibility.md#react-next-compatibility-req-007)
// @see [react-next-compatibility: incomplete framework semantics become evaluation errors rather than exemptions.](./framework-compatibility.md#react-next-compatibility-req-012)
// @see [react-next-compatibility: the CLI keeps independent policy findings when a narrow exception applies.](./framework-compatibility.md#react-next-compatibility-prop-req-007-01)
// @see [next-routing-config-resolution: the CLI runs ordinary validators after framework eligibility analysis.](./framework-compatibility.md#react-next-compatibility-req-003)
// @see [next-routing-config-resolution: the CLI retains independent findings alongside framework exceptions.](./framework-compatibility.md#react-next-compatibility-prop-req-007-01)
// @see [nextjs-client-directive-exemption: The CLI builds analysis only from files selected by configured include patterns.](./repeated-strings.md#nextjs-client-directive-exemption-req-005)
// @see [nextjs-client-directive-exemption: The CLI continues running unrelated policy validators alongside the directive exception.](./repeated-strings.md#nextjs-client-directive-exemption-req-007)
// @see [nextjs-client-directive-exemption: The CLI retains unrelated findings when qualifying client directives are exempted.](./repeated-strings.md#nextjs-client-directive-exemption-prop-req-007-01)
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
        { analyzeFrameworkCompatibility },
        { resolveFrameworkContext },
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
        import("./compatibility-analyser.js"),
        import("./framework-context.js"),
      ]);
      const analysis = createTypeScriptAnalysis(selectedFiles);
      try {
        let compatibility;
        let frameworkContext;
        try {
          frameworkContext = resolveFrameworkContext(process.cwd());
          const hasConfiguredJsx =
            analysis.program?.getCompilerOptions().jsx !== undefined;
          if (frameworkContext.next.status !== "absent" || hasConfiguredJsx) {
            compatibility = analyzeFrameworkCompatibility(analysis, {
              cwd: process.cwd(),
              frameworkContext,
            });
          }
        } catch (error) {
          analysis.evaluationErrors.push({
            kind: "framework-compatibility",
            message:
              `Could not complete framework compatibility analysis: ${
                error instanceof Error ? error.message : String(error)
              }`,
          });
        }

        policyViolations = [
          ...findLetDeclarationViolations(analysis.sourceFiles),
          ...findFileStructureViolations(analysis.sourceFiles),
          ...findExportViolations(analysis, compatibility),
          ...findImportedValueViolations(analysis),
          ...findPrivateInstanceStateViolations(analysis.sourceFiles),
          ...findInterfaceViolations(analysis),
          ...findTypeAnnotationViolations(analysis.sourceFiles),
          ...findTypeAliasAndUnionViolations(analysis.sourceFiles),
          ...findSyntaxStyleViolations(analysis, compatibility),
          ...findCommentViolations(analysis),
          ...findRepeatedStringViolations(analysis, frameworkContext),
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
