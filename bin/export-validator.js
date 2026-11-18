import ts from "typescript";

function diagnosticAt(sourceFile, filePath, position, requirementId, message) {
  const location = sourceFile.getLineAndCharacterOfPosition(position);
  return {
    filePath,
    line: location.line + 1,
    column: location.character + 1,
    requirementId,
    message,
    start: position,
  };
}

function addLocalValue(values, name, declaration, variableDeclaration) {
  if (!ts.isIdentifier(name)) {
    return;
  }

  const value = {
    declaration,
    variableDeclaration,
    isConst: variableDeclaration?.parent.flags !== undefined &&
      (variableDeclaration.parent.flags & ts.NodeFlags.Const) !== 0,
    hasDirectBinding:
      variableDeclaration === undefined ||
      ts.isIdentifier(variableDeclaration.name),
  };
  const declarations = values.get(name.text) ?? [];
  declarations.push(value);
  values.set(name.text, declarations);
}

function addBindingNames(values, bindingName, declaration, variableDeclaration) {
  if (ts.isIdentifier(bindingName)) {
    addLocalValue(values, bindingName, declaration, variableDeclaration);
    return;
  }

  if (ts.isObjectBindingPattern(bindingName) || ts.isArrayBindingPattern(bindingName)) {
    for (const element of bindingName.elements) {
      if (ts.isBindingElement(element)) {
        addBindingNames(values, element.name, declaration, variableDeclaration);
      }
    }
  }
}

function localValueDeclarations(sourceFile) {
  const values = new Map();

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        addBindingNames(values, declaration.name, declaration, declaration);
      }
      continue;
    }

    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement) ||
      ts.isModuleDeclaration(statement)
    ) {
      if (statement.name !== undefined) {
        addLocalValue(values, statement.name, statement, undefined);
      }
    }
  }

  return values;
}

function isTypeOnlyExport(statement, specifier) {
  return statement.isTypeOnly || specifier.isTypeOnly;
}

function localExportListViolations(selectedFile, localValues) {
  const { sourceFile, displayPath } = selectedFile;
  const violations = [];

  for (const statement of sourceFile.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      statement.moduleSpecifier !== undefined ||
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      continue;
    }

    for (const specifier of statement.exportClause.elements) {
      if (isTypeOnlyExport(statement, specifier)) {
        continue;
      }

      const localName = specifier.propertyName ?? specifier.name;
      if (!ts.isIdentifier(localName) || !localValues.has(localName.text)) {
        continue;
      }

      const position = specifier.getStart(sourceFile);
      violations.push(
        diagnosticAt(
          sourceFile,
          displayPath,
          position,
          "REQ-020",
          `Local value "${localName.text}" must be exported inline instead of through a separate export list.`,
        ),
      );
    }
  }

  return violations;
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

function forbiddenExportKind(expression) {
  const unwrapped = unwrapExpression(expression);
  if (ts.isObjectLiteralExpression(unwrapped)) {
    return "an object literal";
  }
  if (ts.isNewExpression(unwrapped)) {
    return "a class instance";
  }
  if (
    ts.isCallExpression(unwrapped) &&
    ts.isPropertyAccessExpression(unwrapped.expression) &&
    ts.isIdentifier(unwrapped.expression.expression) &&
    unwrapped.expression.expression.text === "Object" &&
    unwrapped.expression.name.text === "freeze" &&
    unwrapped.arguments.length > 0 &&
    ts.isObjectLiteralExpression(unwrapExpression(unwrapped.arguments[0]))
  ) {
    return "an Object.freeze object literal";
  }
  return undefined;
}

function isConstVariable(value) {
  return value.variableDeclaration !== undefined && value.isConst;
}

function exportedObjectViolations(selectedFile, localValues) {
  const { sourceFile, displayPath } = selectedFile;
  const violations = [];
  const reportedVariables = new Set();

  function reportConst(value, position, exportName) {
    const declaration = value.variableDeclaration;
    if (
      !isConstVariable(value) ||
      !value.hasDirectBinding ||
      declaration.initializer === undefined ||
      reportedVariables.has(declaration)
    ) {
      return;
    }

    const kind = forbiddenExportKind(declaration.initializer);
    if (kind === undefined) {
      return;
    }

    reportedVariables.add(declaration);
    violations.push(
      diagnosticAt(
        sourceFile,
        displayPath,
        position,
        "REQ-021",
        `Exported const "${exportName}" must not expose ${kind}.`,
      ),
    );
  }

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      const isInlineExport = (ts.getModifiers(statement) ?? []).some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      );
      if (!isInlineExport || (statement.declarationList.flags & ts.NodeFlags.Const) === 0) {
        continue;
      }

      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          continue;
        }
        const values = localValues.get(declaration.name.text) ?? [];
        const value = values.find(
          (candidate) => candidate.variableDeclaration === declaration,
        );
        if (value !== undefined) {
          reportConst(value, declaration.name.getStart(sourceFile), declaration.name.text);
        }
      }
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier === undefined &&
      statement.exportClause !== undefined &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const specifier of statement.exportClause.elements) {
        if (isTypeOnlyExport(statement, specifier)) {
          continue;
        }

        const localName = specifier.propertyName ?? specifier.name;
        if (!ts.isIdentifier(localName)) {
          continue;
        }
        for (const value of localValues.get(localName.text) ?? []) {
          reportConst(value, specifier.getStart(sourceFile), localName.text);
        }
      }
    }

    if (!ts.isExportAssignment(statement) || statement.isExportEquals) {
      continue;
    }

    const expression = unwrapExpression(statement.expression);
    const directKind = forbiddenExportKind(expression);
    if (directKind !== undefined) {
      violations.push(
        diagnosticAt(
          sourceFile,
          displayPath,
          expression.getStart(sourceFile),
          "REQ-021",
          `Default export must not expose ${directKind}.`,
        ),
      );
      continue;
    }

    if (ts.isIdentifier(expression)) {
      for (const value of localValues.get(expression.text) ?? []) {
        if (!isConstVariable(value) || !value.hasDirectBinding) {
          continue;
        }
        const initializer = value.variableDeclaration.initializer;
        if (initializer === undefined) {
          continue;
        }
        const kind = forbiddenExportKind(initializer);
        if (kind !== undefined) {
          reportConst(
            value,
            expression.getStart(sourceFile),
            expression.text,
          );
        }
      }
    }
  }

  return violations;
}

const CALLABLE_EXPORT_REQUIREMENT_ID = "REQ-018";
const UNRESOLVED_CALLABILITY_FLAGS =
  ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.TypeParameter;

function nameText(name) {
  if (typeof name === "string") {
    return name;
  }
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name)
    ? name.text
    : undefined;
}

function addExportRoute(routes, name, node, typeOnly = false) {
  const text = nameText(name);
  if (text === undefined) {
    return;
  }
  const candidates = routes.get(text) ?? [];
  candidates.push({ node, typeOnly });
  routes.set(text, candidates);
}

function addBindingExportRoutes(routes, bindingName) {
  if (ts.isIdentifier(bindingName)) {
    addExportRoute(routes, bindingName, bindingName);
    return;
  }

  if (ts.isObjectBindingPattern(bindingName) || ts.isArrayBindingPattern(bindingName)) {
    for (const element of bindingName.elements) {
      if (ts.isBindingElement(element)) {
        addBindingExportRoutes(routes, element.name);
      }
    }
  }
}

function exportRoutesFor(sourceFile) {
  const routes = new Map();
  const starExports = [];

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause === undefined) {
        if (statement.moduleSpecifier !== undefined && !statement.isTypeOnly) {
          starExports.push(statement);
        }
        continue;
      }

      if (ts.isNamedExports(statement.exportClause)) {
        for (const specifier of statement.exportClause.elements) {
          addExportRoute(
            routes,
            specifier.name,
            specifier,
            statement.isTypeOnly || specifier.isTypeOnly,
          );
        }
      } else if (ts.isNamespaceExport(statement.exportClause)) {
        addExportRoute(routes, statement.exportClause.name, statement.exportClause);
      }
      continue;
    }

    if (ts.isExportAssignment(statement)) {
      addExportRoute(
        routes,
        statement.isExportEquals ? "export=" : "default",
        statement.expression,
      );
      continue;
    }

    const modifiers = ts.getModifiers(statement) ?? [];
    const isDefault = modifiers.some(
      (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
    );
    const isExported = isDefault || modifiers.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!isExported) {
      continue;
    }

    if (isDefault) {
      addExportRoute(routes, "default", statement.name ?? statement);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        addBindingExportRoutes(routes, declaration.name);
      }
    } else if (statement.name !== undefined) {
      addExportRoute(routes, statement.name, statement.name);
    }
  }

  return { routes, starExports };
}

function reportUnresolvedCallableExport(analysis, sourceNode) {
  analysis.requireResolvedSemanticInformation(
    undefined,
    sourceNode,
    "callable export information required by REQ-018",
  );
}

function resolvedSymbolForExport(analysis, symbol, sourceNode) {
  if (symbol === undefined || symbol.flags === 0) {
    reportUnresolvedCallableExport(analysis, sourceNode);
    return undefined;
  }

  let resolvedSymbol = symbol;
  if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) {
    try {
      resolvedSymbol = analysis.checker.getAliasedSymbol(symbol);
    } catch {
      reportUnresolvedCallableExport(analysis, sourceNode);
      return undefined;
    }
  }

  if (
    resolvedSymbol === undefined ||
    resolvedSymbol.flags === 0 ||
    (resolvedSymbol.flags & ts.SymbolFlags.Alias) !== 0
  ) {
    reportUnresolvedCallableExport(analysis, sourceNode);
    return undefined;
  }

  return resolvedSymbol;
}

function moduleExportsForStar(analysis, selectedFile, statement) {
  let moduleSymbol;
  try {
    moduleSymbol = analysis.checker.getSymbolAtLocation(statement.moduleSpecifier);
  } catch {
    reportUnresolvedCallableExport(analysis, statement);
    return undefined;
  }

  if (moduleSymbol === undefined) {
    reportUnresolvedCallableExport(analysis, statement);
    return undefined;
  }

  try {
    return analysis.checker.getExportsOfModule(moduleSymbol);
  } catch {
    reportUnresolvedCallableExport(analysis, statement);
    return undefined;
  }
}

function routeForExport(exportName, routes, starExports) {
  const explicitRoute = (routes.get(exportName) ?? []).find(
    (route) => !route.typeOnly,
  );
  if (explicitRoute !== undefined) {
    return explicitRoute.node;
  }

  if (exportName === "default") {
    return undefined;
  }

  for (const { statement, exports } of starExports) {
    if (exports?.some((symbol) => symbol.getName() === exportName)) {
      return statement;
    }
  }

  return undefined;
}

function callableExportViolations(
  analysis,
  selectedFile,
  eligibleReq018Routes,
) {
  const { sourceFile, displayPath } = selectedFile;
  if (!ts.isExternalModule(sourceFile)) {
    return [];
  }

  const violations = [];
  const { checker } = analysis;
  if (checker === undefined) {
    reportUnresolvedCallableExport(analysis, sourceFile);
    return violations;
  }

  let moduleSymbol;
  let exportedSymbols;
  try {
    moduleSymbol = sourceFile.symbol ?? checker.getSymbolAtLocation(sourceFile);
    if (moduleSymbol === undefined) {
      reportUnresolvedCallableExport(analysis, sourceFile);
      return violations;
    }
    exportedSymbols = checker.getExportsOfModule(moduleSymbol);
  } catch {
    reportUnresolvedCallableExport(analysis, sourceFile);
    return violations;
  }

  const { routes, starExports: starExportStatements } = exportRoutesFor(sourceFile);
  const starExports = starExportStatements.map((statement) => ({
    statement,
    exports: moduleExportsForStar(analysis, selectedFile, statement),
  }));

  for (const exportedSymbol of exportedSymbols) {
    const exportName = exportedSymbol.getName();
    const route = routeForExport(exportName, routes, starExports);
    if (route === undefined || eligibleReq018Routes?.has(route) === true) {
      continue;
    }

    const targetSymbol = resolvedSymbolForExport(analysis, exportedSymbol, route);
    if (targetSymbol === undefined || (targetSymbol.flags & ts.SymbolFlags.Value) === 0) {
      continue;
    }

    const declaration = targetSymbol.valueDeclaration ?? targetSymbol.declarations?.[0];
    let exportedType;
    try {
      exportedType = checker.getTypeOfSymbolAtLocation(
        targetSymbol,
        declaration ?? route,
      );
    } catch {
      reportUnresolvedCallableExport(analysis, route);
      continue;
    }

    if (
      exportedType === undefined ||
      (exportedType.flags & UNRESOLVED_CALLABILITY_FLAGS) !== 0
    ) {
      reportUnresolvedCallableExport(analysis, route);
      continue;
    }

    let callSignatures;
    try {
      callSignatures = checker.getSignaturesOfType(
        exportedType,
        ts.SignatureKind.Call,
      );
    } catch {
      reportUnresolvedCallableExport(analysis, route);
      continue;
    }

    if (callSignatures.length === 0) {
      continue;
    }

    const position = route.getStart(sourceFile);
    violations.push(
      diagnosticAt(
        sourceFile,
        displayPath,
        position,
        CALLABLE_EXPORT_REQUIREMENT_ID,
        `Exported value "${exportName}" must not be callable.`,
      ),
    );
  }

  return violations;
}

/** Find REQ-018, REQ-020, and REQ-021 violations in the selected TypeScript modules. */
// @see [Tightscript: export findings include their file, source location, and requirement ID.](./diagnostics.md#tightscript-req-004)
// @see [Tightscript: callable exports are rejected unless an approved framework exception applies.](./exports.md#tightscript-req-018)
// @see [Tightscript: export analysis rejects local values exposed through separate export lists.](./exports.md#tightscript-req-020)
// @see [Tightscript: export analysis rejects object-shaped constant and default exports.](./exports.md#tightscript-req-021)
// @see [Tightscript: export findings retain the source and rule details required of every diagnostic.](./diagnostics.md#tightscript-prop-req-004-01)
// @see [Tightscript: callable exports fail unless a qualifying exception is proven.](./exports.md#tightscript-prop-req-018-01)
// @see [react-next-compatibility: the exporter skips REQ-018 only for analyser-approved React or Next.js routes.](./framework-compatibility.md#react-next-compatibility-req-004)
// @see [react-next-compatibility: the exporter applies only Next.js exceptions supported by the closed role table.](./framework-compatibility.md#react-next-compatibility-req-005)
// @see [react-next-compatibility: the exporter retains all unrelated callable-export and export-list policies.](./framework-compatibility.md#react-next-compatibility-req-003)
// @see [react-next-compatibility: REQ-019 and REQ-020 continue independently of eligible callable exports.](./framework-compatibility.md#react-next-compatibility-req-007)
// @see [react-next-compatibility: ineligible callable exports remain subject to REQ-018.](./framework-compatibility.md#react-next-compatibility-req-011)
// @see [react-next-compatibility: eligible routes suppress only their proven callable-export finding.](./framework-compatibility.md#react-next-compatibility-prop-req-004-01)
// @see [react-next-compatibility: other export findings remain after a narrow framework exception.](./framework-compatibility.md#react-next-compatibility-prop-req-007-01)
export function findExportViolations(analysis, compatibility) {
  const violations = [];
  const eligibleReq018Routes = compatibility?.eligibleReq018Routes;

  for (const selectedFile of analysis.sourceFiles) {
    const localValues = localValueDeclarations(selectedFile.sourceFile);
    violations.push(
      ...callableExportViolations(
        analysis,
        selectedFile,
        eligibleReq018Routes,
      ),
    );
    violations.push(...localExportListViolations(selectedFile, localValues));
    violations.push(...exportedObjectViolations(selectedFile, localValues));
  }

  return violations;
}
