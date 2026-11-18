import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import ts from "typescript";

const NEXT_CONFIG_FILENAMES = [
  "next.config.js",
  "next.config.mjs",
  "next.config.cjs",
  "next.config.ts",
  "next.config.mts",
  "next.config.cts",
];
const DEFAULT_PAGE_EXTENSIONS = ["tsx", "ts", "jsx", "js"];
const PACKAGE_RESOLUTION_ANCHOR = "__tightscript_framework_context__.cjs";

function isPathWithin(directoryPath, candidatePath) {
  const pathFromDirectory = relative(directoryPath, candidatePath);
  return (
    pathFromDirectory === "" ||
    (pathFromDirectory !== ".." &&
      !pathFromDirectory.startsWith(`..${sep}`) &&
      !isAbsolute(pathFromDirectory))
  );
}

function candidateNextPackageRoots(projectRequire) {
  const resolutionPaths = projectRequire.resolve.paths("next") ?? [];
  const roots = [];
  for (const resolutionPath of resolutionPaths) {
    const candidatePath = join(resolutionPath, "next");
    try {
      const packageRoot = realpathSync(candidatePath);
      if (statSync(packageRoot).isDirectory()) {
        roots.push(packageRoot);
      }
    } catch {
      // A missing candidate is normal while walking Node's resolution paths.
    }
  }
  return roots;
}

function nextPackageRootFromEntry(projectRequire, entryPath) {
  let realEntryPath;
  try {
    realEntryPath = realpathSync(entryPath);
  } catch {
    return undefined;
  }

  const packageRoots = candidateNextPackageRoots(projectRequire);
  for (const packageRoot of packageRoots) {
    if (isPathWithin(packageRoot, realEntryPath)) {
      return packageRoot;
    }
  }

  let directoryPath = dirname(realEntryPath);
  while (directoryPath !== dirname(directoryPath)) {
    if (basename(directoryPath) === "next") {
      return directoryPath;
    }
    try {
      const metadata = JSON.parse(
        readFileSync(join(directoryPath, "package.json"), "utf8"),
      );
      if (metadata.name === "next") {
        return directoryPath;
      }
    } catch {
      // Keep looking in case an enclosing package owns the resolved entry.
    }
    directoryPath = dirname(directoryPath);
  }

  return undefined;
}

function nextContextForUnresolvedEntry(projectRequire) {
  for (const packageRoot of candidateNextPackageRoots(projectRequire)) {
    try {
      lstatSync(join(packageRoot, "package.json"));
      return { status: "indeterminate", packageRoot };
    } catch {
      // A directory without package metadata is not a resolved Next package.
    }
  }
  return { status: "absent" };
}

function majorFromVersion(version) {
  if (typeof version !== "string") {
    return undefined;
  }

  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(
    version,
  );
  return match === null ? undefined : Number(match[1]);
}

function resolveNextContext(cwd, readTextFile) {
  const projectRequire = createRequire(resolve(cwd, PACKAGE_RESOLUTION_ANCHOR));
  let entryPath;
  try {
    // Resolution inspects package metadata but does not load the resolved module.
    entryPath = projectRequire.resolve("next");
  } catch {
    return nextContextForUnresolvedEntry(projectRequire);
  }

  const packageRoot = nextPackageRootFromEntry(projectRequire, entryPath);
  if (packageRoot === undefined) {
    return { status: "indeterminate" };
  }

  let metadata;
  try {
    metadata = JSON.parse(readTextFile(join(packageRoot, "package.json")));
  } catch {
    return { status: "indeterminate", packageRoot };
  }

  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    return { status: "indeterminate", packageRoot };
  }

  const major = majorFromVersion(metadata.version);
  if (metadata.name !== "next" || major === undefined) {
    return { status: "indeterminate", packageRoot };
  }

  return {
    status: major === 16 ? "supported" : "unsupported",
    packageRoot,
    version: metadata.version,
    major,
  };
}

function unwrapExpression(expression) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function constInitializerFor(sourceFile, identifierText) {
  const matches = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    if ((statement.declarationList.flags & ts.NodeFlags.Const) === 0) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === identifierText &&
        declaration.initializer !== undefined
      ) {
        matches.push(declaration.initializer);
      }
    }
  }
  return matches.length === 1 ? matches[0] : undefined;
}

function staticallyRepresentable(expression, sourceFile, resolving = new Set()) {
  const current = unwrapExpression(expression);
  if (
    ts.isStringLiteralLike(current) ||
    ts.isNumericLiteral(current) ||
    ts.isBigIntLiteral(current) ||
    current.kind === ts.SyntaxKind.TrueKeyword ||
    current.kind === ts.SyntaxKind.FalseKeyword ||
    current.kind === ts.SyntaxKind.NullKeyword
  ) {
    return true;
  }

  if (ts.isIdentifier(current)) {
    if (resolving.has(current.text)) {
      return false;
    }
    const initializer = constInitializerFor(sourceFile, current.text);
    if (initializer === undefined) {
      return false;
    }
    const nextResolving = new Set(resolving);
    nextResolving.add(current.text);
    return staticallyRepresentable(initializer, sourceFile, nextResolving);
  }

  if (ts.isArrayLiteralExpression(current)) {
    return current.elements.every(
      (element) =>
        !ts.isSpreadElement(element) &&
        staticallyRepresentable(element, sourceFile, resolving),
    );
  }

  if (ts.isObjectLiteralExpression(current)) {
    return current.properties.every((property) => {
      if (ts.isPropertyAssignment(property)) {
        return (
          staticPropertyName(property.name) !== undefined &&
          staticallyRepresentable(property.initializer, sourceFile, resolving)
        );
      }
      if (ts.isShorthandPropertyAssignment(property)) {
        return staticallyRepresentable(property.name, sourceFile, resolving);
      }
      return false;
    });
  }

  return false;
}

function staticPropertyName(name) {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteralLike(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }
  return undefined;
}

function isModuleExportsAssignment(statement) {
  if (!ts.isExpressionStatement(statement)) {
    return false;
  }
  const expression = unwrapExpression(statement.expression);
  if (
    !ts.isBinaryExpression(expression) ||
    expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken
  ) {
    return false;
  }

  const left = unwrapExpression(expression.left);
  return (
    ts.isPropertyAccessExpression(left) &&
    ts.isIdentifier(left.expression) &&
    left.expression.text === "module" &&
    left.name.text === "exports"
  );
}

function isTypeOnlyDeclaration(statement) {
  return (
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEmptyStatement(statement)
  );
}

function configExpressionFrom(sourceFile) {
  const expressions = [];
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      expressions.push(statement.expression);
      continue;
    }
    if (isModuleExportsAssignment(statement)) {
      expressions.push(
        unwrapExpression(statement.expression).right,
      );
      continue;
    }

    if (ts.isImportDeclaration(statement)) {
      if (statement.importClause?.isTypeOnly === true) {
        continue;
      }
      return undefined;
    }
    if (ts.isImportEqualsDeclaration(statement)) {
      if (statement.isTypeOnly) {
        continue;
      }
      return undefined;
    }
    if (ts.isVariableStatement(statement)) {
      if ((statement.declarationList.flags & ts.NodeFlags.Const) === 0) {
        return undefined;
      }
      if (
        statement.declarationList.declarations.some(
          (declaration) =>
            declaration.initializer === undefined ||
            !staticallyRepresentable(declaration.initializer, sourceFile),
        )
      ) {
        return undefined;
      }
      continue;
    }
    if (isTypeOnlyDeclaration(statement)) {
      continue;
    }
    return undefined;
  }

  return expressions.length === 1 ? expressions[0] : undefined;
}

function objectExpressionFrom(expression, sourceFile, resolving = new Set()) {
  const current = unwrapExpression(expression);
  if (ts.isObjectLiteralExpression(current)) {
    return current;
  }
  if (!ts.isIdentifier(current) || resolving.has(current.text)) {
    return undefined;
  }

  const initializer = constInitializerFor(sourceFile, current.text);
  if (initializer === undefined) {
    return undefined;
  }
  const nextResolving = new Set(resolving);
  nextResolving.add(current.text);
  return objectExpressionFrom(initializer, sourceFile, nextResolving);
}

function staticStringArray(expression, sourceFile, resolving = new Set()) {
  let current = unwrapExpression(expression);
  if (ts.isIdentifier(current)) {
    if (resolving.has(current.text)) {
      return undefined;
    }
    const initializer = constInitializerFor(sourceFile, current.text);
    if (initializer === undefined) {
      return undefined;
    }
    const nextResolving = new Set(resolving);
    nextResolving.add(current.text);
    return staticStringArray(initializer, sourceFile, nextResolving);
  }
  if (!ts.isArrayLiteralExpression(current)) {
    return undefined;
  }

  const values = [];
  for (const element of current.elements) {
    if (ts.isSpreadElement(element)) {
      return undefined;
    }
    const value = unwrapExpression(element);
    if (!ts.isStringLiteralLike(value)) {
      return undefined;
    }
    values.push(value.text);
  }
  return values;
}

function classifyConfigSource(contents, configPath) {
  const extension = configPath.slice(configPath.lastIndexOf("."));
  const scriptKind = [".ts", ".mts", ".cts"].includes(extension)
    ? ts.ScriptKind.TS
    : ts.ScriptKind.JS;
  const sourceFile = ts.createSourceFile(
    configPath,
    contents,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    return { status: "indeterminate" };
  }

  const configExpression = configExpressionFrom(sourceFile);
  if (configExpression === undefined) {
    return { status: "indeterminate" };
  }
  const configObject = objectExpressionFrom(configExpression, sourceFile);
  if (configObject === undefined) {
    return { status: "indeterminate" };
  }

  const pageExtensionsProperties = [];
  for (const property of configObject.properties) {
    if (ts.isSpreadAssignment(property)) {
      return { status: "indeterminate" };
    }
    if (ts.isPropertyAssignment(property)) {
      const name = staticPropertyName(property.name);
      if (name === undefined) {
        return { status: "indeterminate" };
      }
      if (name === "pageExtensions") {
        pageExtensionsProperties.push(property);
      }
      continue;
    }

    if (ts.isShorthandPropertyAssignment(property)) {
      if (property.name.text === "pageExtensions") {
        return { status: "indeterminate" };
      }
      continue;
    }

    const name = staticPropertyName(property.name);
    if (name === undefined) {
      return { status: "indeterminate" };
    }
    if (name === "pageExtensions") {
      return { status: "indeterminate" };
    }
  }

  if (pageExtensionsProperties.length === 0) {
    return { status: "default" };
  }
  if (pageExtensionsProperties.length !== 1) {
    return { status: "indeterminate" };
  }

  const pageExtensions = staticStringArray(
    pageExtensionsProperties[0].initializer,
    sourceFile,
  );
  if (pageExtensions === undefined) {
    return { status: "indeterminate" };
  }

  return {
    status:
      pageExtensions.length === DEFAULT_PAGE_EXTENSIONS.length &&
      pageExtensions.every(
        (extensionName, index) =>
          extensionName === DEFAULT_PAGE_EXTENSIONS[index],
      )
        ? "default"
        : "changed",
  };
}

function routingConfigurationFor(cwd, readTextFile) {
  const configPaths = [];
  for (const filename of NEXT_CONFIG_FILENAMES) {
    const configPath = join(cwd, filename);
    let linkStats;
    try {
      linkStats = lstatSync(configPath);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") {
        continue;
      }
      return { status: "indeterminate" };
    }

    let fileStats = linkStats;
    if (linkStats.isSymbolicLink()) {
      try {
        fileStats = statSync(configPath);
      } catch {
        return { status: "indeterminate" };
      }
    }
    if (!fileStats.isFile()) {
      return { status: "indeterminate" };
    }
    configPaths.push(configPath);
  }

  if (configPaths.length === 0) {
    return { status: "default" };
  }
  if (configPaths.length !== 1) {
    return { status: "indeterminate" };
  }

  let contents;
  try {
    contents = readTextFile(configPaths[0]);
  } catch {
    return { status: "indeterminate" };
  }
  return classifyConfigSource(contents, configPaths[0]);
}

/** Resolve Next.js package context and statically inspect routing-role configuration. */
export function resolveFrameworkContext(cwd = process.cwd(), options = {}) {
  const currentDirectory = resolve(cwd);
  const readTextFile =
    options.readTextFile ?? ((filePath) => readFileSync(filePath, "utf8"));

  return {
    next: resolveNextContext(currentDirectory, readTextFile),
    routingConfiguration: routingConfigurationFor(
      currentDirectory,
      readTextFile,
    ),
  };
}
