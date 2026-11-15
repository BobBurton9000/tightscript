import { existsSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const CONFIG_FILENAME = "tsconfig.json";
const EMPTY_CONFIG_INPUTS_DIAGNOSTIC = 18003;
const MISSING_PROGRAM_ROOT_DIAGNOSTIC = 6053;

function displayPathFor(filePath, selectedPaths) {
  return selectedPaths.get(resolve(filePath)) ?? filePath;
}

function evaluationErrorFromDiagnostic(
  diagnostic,
  kind,
  selectedPaths,
) {
  const error = {
    kind,
    code: diagnostic.code,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  };

  if (diagnostic.file !== undefined) {
    error.filePath = displayPathFor(diagnostic.file.fileName, selectedPaths);
    if (diagnostic.start !== undefined) {
      const location = diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start,
      );
      error.line = location.line + 1;
      error.column = location.character + 1;
      error.start = diagnostic.start;
    }
  }

  return error;
}

function evaluationErrorFromException(error, kind, filePath) {
  return {
    kind,
    filePath,
    message: error instanceof Error ? error.message : String(error),
  };
}

function compilerOptionsFrom(cwd, evaluationErrors, selectedPaths) {
  const configPath = resolve(cwd, CONFIG_FILENAME);
  if (!existsSync(configPath)) {
    return {};
  }

  const configResult = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configResult.error !== undefined) {
    evaluationErrors.push(
      evaluationErrorFromDiagnostic(
        configResult.error,
        "compiler-config",
        selectedPaths,
      ),
    );
    return {};
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configResult.config,
    ts.sys,
    cwd,
    undefined,
    configPath,
  );
  for (const diagnostic of parsedConfig.errors) {
    if (diagnostic.code !== EMPTY_CONFIG_INPUTS_DIAGNOSTIC) {
      evaluationErrors.push(
        evaluationErrorFromDiagnostic(
          diagnostic,
          "compiler-config",
          selectedPaths,
        ),
      );
    }
  }

  return parsedConfig.options;
}

function selectedSourceFilesFrom(
  program,
  selectedFiles,
  evaluationErrors,
  selectedPaths,
) {
  const sourceFiles = [];
  for (const selectedFile of selectedFiles) {
    const sourceFile = program.getSourceFile(selectedFile.filePath);
    if (sourceFile === undefined) {
      evaluationErrors.push({
        kind: "source-read",
        filePath: selectedFile.displayPath,
        message: "TypeScript could not read the selected source file.",
      });
      continue;
    }

    sourceFiles.push({ ...selectedFile, sourceFile });
    try {
      for (const diagnostic of program.getSyntacticDiagnostics(sourceFile)) {
        evaluationErrors.push({
          ...evaluationErrorFromDiagnostic(
            diagnostic,
            "source-syntax",
            selectedPaths,
          ),
          filePath: selectedFile.displayPath,
        });
      }
    } catch (error) {
      evaluationErrors.push(
        evaluationErrorFromException(
          error,
          "source-read",
          selectedFile.displayPath,
        ),
      );
    }
  }

  return sourceFiles;
}

function sourceLocationFromNode(node, selectedPaths) {
  if (node === undefined || node === null) {
    return {};
  }

  const sourceFile = node.getSourceFile();
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    filePath: displayPathFor(sourceFile.fileName, selectedPaths),
    line: position.line + 1,
    column: position.character + 1,
    start: node.getStart(sourceFile),
  };
}

/** Build a TypeScript program over exactly the source-scope-selected roots. */
export function createTypeScriptAnalysis(selectedFiles, cwd = process.cwd()) {
  const currentDirectory = resolve(cwd);
  const selectedPaths = new Map(
    selectedFiles.map((selectedFile) => [
      resolve(selectedFile.filePath),
      selectedFile.displayPath,
    ]),
  );
  const evaluationErrors = [];
  let compilerOptions = {};

  try {
    compilerOptions = compilerOptionsFrom(
      currentDirectory,
      evaluationErrors,
      selectedPaths,
    );
  } catch (error) {
    evaluationErrors.push(
      evaluationErrorFromException(
        error,
        "compiler-config",
        resolve(currentDirectory, CONFIG_FILENAME),
      ),
    );
  }

  let program;
  try {
    const compilerHost = ts.createCompilerHost(compilerOptions);
    compilerHost.getCurrentDirectory = () => currentDirectory;
    program = ts.createProgram(
      selectedFiles.map((selectedFile) => resolve(selectedFile.filePath)),
      compilerOptions,
      compilerHost,
    );
  } catch (error) {
    evaluationErrors.push(
      evaluationErrorFromException(error, "program-construction"),
    );
    return {
      program: undefined,
      checker: undefined,
      sourceFiles: [],
      evaluationErrors,
      requireResolvedSemanticInformation() {
        return undefined;
      },
    };
  }

  try {
    for (const diagnostic of program.getOptionsDiagnostics()) {
      if (diagnostic.code !== MISSING_PROGRAM_ROOT_DIAGNOSTIC) {
        evaluationErrors.push(
          evaluationErrorFromDiagnostic(
            diagnostic,
            "compiler-config",
            selectedPaths,
          ),
        );
      }
    }
  } catch (error) {
    evaluationErrors.push(
      evaluationErrorFromException(error, "compiler-config"),
    );
  }

  const sourceFiles = selectedSourceFilesFrom(
    program,
    selectedFiles.map((selectedFile) => ({
      ...selectedFile,
      filePath: resolve(selectedFile.filePath),
    })),
    evaluationErrors,
    selectedPaths,
  );
  let checker;
  try {
    checker = program.getTypeChecker();
  } catch (error) {
    evaluationErrors.push(
      evaluationErrorFromException(error, "program-construction"),
    );
  }

  return {
    program,
    checker,
    sourceFiles,
    evaluationErrors,
    requireResolvedSemanticInformation(value, sourceNode, reason) {
      if (value !== undefined && value !== null) {
        return value;
      }

      evaluationErrors.push({
        kind: "semantic-resolution",
        ...sourceLocationFromNode(sourceNode, selectedPaths),
        message: `Could not resolve ${reason}.`,
      });
      return undefined;
    },
  };
}
