import ts from "typescript";

const IMPORTED_VALUE_REQUIREMENT_ID = "REQ-019";

function diagnosticAt(sourceFile, filePath, position, message) {
  const location = sourceFile.getLineAndCharacterOfPosition(position);
  return {
    filePath,
    line: location.line + 1,
    column: location.character + 1,
    requirementId: IMPORTED_VALUE_REQUIREMENT_ID,
    message,
    start: position,
  };
}

function symbolForReference(checker, identifier) {
  const parent = identifier.parent;
  if (ts.isShorthandPropertyAssignment(parent) && parent.name === identifier) {
    return checker.getShorthandAssignmentValueSymbol(parent);
  }
  if (ts.isExportSpecifier(parent)) {
    return checker.getExportSpecifierLocalTargetSymbol(parent);
  }
  return checker.getSymbolAtLocation(identifier);
}

function isReferenceIdentifier(identifier) {
  const parent = identifier.parent;
  if (
    ts.isImportClause(parent) ||
    ts.isImportSpecifier(parent) ||
    ts.isNamespaceImport(parent)
  ) {
    return false;
  }
  if (ts.isExportSpecifier(parent)) {
    const exportDeclaration = parent.parent.parent;
    if (exportDeclaration.moduleSpecifier !== undefined) {
      return false;
    }
    return parent.propertyName === identifier ||
      (parent.propertyName === undefined && parent.name === identifier);
  }
  if (
    ts.isShorthandPropertyAssignment(parent) &&
    parent.name === identifier
  ) {
    return true;
  }
  if (
    (ts.isPropertyAccessExpression(parent) && parent.name === identifier) ||
    (ts.isPropertyAssignment(parent) && parent.name === identifier)
  ) {
    return false;
  }
  return !ts.isDeclarationName(identifier);
}

function referencesBySymbol(sourceFile, checker) {
  const references = new Map();
  function addReference(identifier) {
    if (!isReferenceIdentifier(identifier)) {
      return;
    }
    const symbol = symbolForReference(checker, identifier);
    if (symbol === undefined) {
      return;
    }
    const symbolReferences = references.get(symbol) ?? new Set();
    symbolReferences.add(identifier);
    references.set(symbol, symbolReferences);
  }
  function visit(node) {
    if (ts.isIdentifier(node)) {
      addReference(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return references;
}

function importBindingsIn(sourceFile, checker) {
  const bindings = new Map();
  function addBinding(identifier) {
    const symbol = checker.getSymbolAtLocation(identifier);
    if (symbol !== undefined) {
      bindings.set(symbol, { identifier, name: identifier.text });
    }
  }

  for (const statement of sourceFile.statements) {
    if (ts.isImportEqualsDeclaration(statement)) {
      if (!statement.isTypeOnly) {
        addBinding(statement.name);
      }
      continue;
    }
    if (!ts.isImportDeclaration(statement) || statement.importClause === undefined) {
      continue;
    }
    const importClause = statement.importClause;
    if (importClause.isTypeOnly) {
      continue;
    }
    if (importClause.name !== undefined) {
      addBinding(importClause.name);
    }
    if (importClause.namedBindings === undefined) {
      continue;
    }
    if (ts.isNamespaceImport(importClause.namedBindings)) {
      addBinding(importClause.namedBindings.name);
      continue;
    }
    for (const specifier of importClause.namedBindings.elements) {
      if (!specifier.isTypeOnly) {
        addBinding(specifier.name);
      }
    }
  }
  return bindings;
}

function localVariableDeclarations(sourceFile, checker) {
  const declarations = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const symbol = checker.getSymbolAtLocation(node.name);
      if (symbol !== undefined) {
        declarations.set(symbol, node);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return declarations;
}

function isConstDeclaration(declaration) {
  return (
    ts.isVariableDeclarationList(declaration.parent) &&
    (declaration.parent.flags & ts.NodeFlags.Const) !== 0
  );
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

function emptyPassthrough() {
  return {
    importSymbols: new Set(),
    importReferences: new Set(),
    localSymbols: new Set(),
    localReferences: new Set(),
  };
}

function mergePassthrough(target, source) {
  for (const symbol of source.importSymbols) {
    target.importSymbols.add(symbol);
  }
  for (const reference of source.importReferences) {
    target.importReferences.add(reference);
  }
  for (const symbol of source.localSymbols) {
    target.localSymbols.add(symbol);
  }
  for (const reference of source.localReferences) {
    target.localReferences.add(reference);
  }
}

function passthroughFromExpression(
  expression,
  checker,
  importBindings,
  variableDeclarations,
  activeSymbols = new Set(),
) {
  const current = unwrapExpression(expression);
  if (ts.isIdentifier(current)) {
    const symbol = symbolForReference(checker, current);
    if (symbol === undefined) {
      return undefined;
    }
    if (importBindings.has(symbol)) {
      const passthrough = emptyPassthrough();
      passthrough.importSymbols.add(symbol);
      passthrough.importReferences.add(current);
      return passthrough;
    }

    const declaration = variableDeclarations.get(symbol);
    if (
      declaration === undefined ||
      !isConstDeclaration(declaration) ||
      declaration.initializer === undefined ||
      activeSymbols.has(symbol)
    ) {
      return undefined;
    }
    const nestedActiveSymbols = new Set(activeSymbols);
    nestedActiveSymbols.add(symbol);
    const passthrough = passthroughFromExpression(
      declaration.initializer,
      checker,
      importBindings,
      variableDeclarations,
      nestedActiveSymbols,
    );
    if (passthrough === undefined || passthrough.importSymbols.size === 0) {
      return undefined;
    }
    passthrough.localSymbols.add(symbol);
    passthrough.localReferences.add(current);
    return passthrough;
  }

  if (!ts.isObjectLiteralExpression(current)) {
    return undefined;
  }
  const passthrough = emptyPassthrough();
  for (const property of current.properties) {
    let valueExpression;
    if (ts.isPropertyAssignment(property)) {
      if (ts.isComputedPropertyName(property.name)) {
        return undefined;
      }
      valueExpression = property.initializer;
    } else if (ts.isShorthandPropertyAssignment(property)) {
      if (property.objectAssignmentInitializer !== undefined) {
        return undefined;
      }
      valueExpression = property.name;
    } else if (ts.isSpreadAssignment(property)) {
      valueExpression = property.expression;
    } else {
      return undefined;
    }

    const memberPassthrough = passthroughFromExpression(
      valueExpression,
      checker,
      importBindings,
      variableDeclarations,
      activeSymbols,
    );
    if (memberPassthrough === undefined) {
      return undefined;
    }
    mergePassthrough(passthrough, memberPassthrough);
  }
  return passthrough.importSymbols.size === 0 ? undefined : passthrough;
}

function hasExportModifier(statement) {
  return (ts.getModifiers(statement) ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );
}

function passthroughExportsIn(
  sourceFile,
  checker,
  importBindings,
  variableDeclarations,
  analysis,
) {
  const passthroughs = [];
  function addExport(expression, rootDeclaration) {
    const passthrough = passthroughFromExpression(
      expression,
      checker,
      importBindings,
      variableDeclarations,
    );
    if (passthrough === undefined || passthrough.importSymbols.size === 0) {
      return;
    }
    if (rootDeclaration !== undefined) {
      const symbol = checker.getSymbolAtLocation(rootDeclaration.name);
      if (symbol === undefined) {
        analysis.requireResolvedSemanticInformation(
          undefined,
          rootDeclaration.name,
          "exported binding information required by REQ-019",
        );
        return;
      }
      passthrough.localSymbols.add(symbol);
    }
    passthroughs.push(passthrough);
  }

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          !isConstDeclaration(declaration) ||
          !ts.isIdentifier(declaration.name) ||
          declaration.initializer === undefined
        ) {
          continue;
        }
        addExport(declaration.initializer, declaration);
      }
      continue;
    }

    if (ts.isExportAssignment(statement)) {
      addExport(statement.expression);
      continue;
    }

    if (
      !ts.isExportDeclaration(statement) ||
      statement.moduleSpecifier !== undefined ||
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      continue;
    }

    for (const specifier of statement.exportClause.elements) {
      if (statement.isTypeOnly || specifier.isTypeOnly) {
        continue;
      }
      addExport(specifier.propertyName ?? specifier.name);
    }
  }
  return passthroughs;
}

function sameReferences(actualReferences, allowedReferences) {
  if (actualReferences.size !== allowedReferences.size) {
    return false;
  }
  for (const reference of actualReferences) {
    if (!allowedReferences.has(reference)) {
      return false;
    }
  }
  return true;
}

function resolvedValueSymbol(analysis, symbol, sourceNode, reason) {
  if (symbol === undefined || symbol.flags === 0) {
    analysis.requireResolvedSemanticInformation(undefined, sourceNode, reason);
    return undefined;
  }
  let resolvedSymbol = symbol;
  if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) {
    try {
      resolvedSymbol = analysis.checker.getAliasedSymbol(symbol);
    } catch {
      analysis.requireResolvedSemanticInformation(undefined, sourceNode, reason);
      return undefined;
    }
  }
  if (
    resolvedSymbol === undefined ||
    resolvedSymbol.flags === 0 ||
    (resolvedSymbol.flags & ts.SymbolFlags.Alias) !== 0
  ) {
    analysis.requireResolvedSemanticInformation(undefined, sourceNode, reason);
    return undefined;
  }
  return resolvedSymbol;
}

function sourceReexportViolations(analysis, selectedFile) {
  const { sourceFile, displayPath } = selectedFile;
  const { checker } = analysis;
  const violations = [];
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      statement.moduleSpecifier === undefined ||
      statement.isTypeOnly
    ) {
      continue;
    }

    if (
      statement.exportClause !== undefined &&
      !ts.isNamedExports(statement.exportClause)
    ) {
      continue;
    }

    if (statement.exportClause !== undefined) {
      for (const specifier of statement.exportClause.elements) {
        if (specifier.isTypeOnly) {
          continue;
        }
        const symbol = checker.getSymbolAtLocation(specifier.name);
        const resolvedSymbol = resolvedValueSymbol(
          analysis,
          symbol,
          specifier,
          "source re-export information required by REQ-019",
        );
        if (
          resolvedSymbol === undefined ||
          (resolvedSymbol.flags & ts.SymbolFlags.Value) === 0
        ) {
          continue;
        }
        violations.push(
          diagnosticAt(
            sourceFile,
            displayPath,
            specifier.getStart(sourceFile),
            `Source re-export "${specifier.name.text}" must not pass an imported value through unchanged.`,
          ),
        );
      }
      continue;
    }

    const moduleSymbol = checker.getSymbolAtLocation(statement.moduleSpecifier);
    const exportedSymbols = moduleSymbol === undefined
      ? undefined
      : checker.getExportsOfModule(moduleSymbol);
    if (exportedSymbols === undefined) {
      analysis.requireResolvedSemanticInformation(
        undefined,
        statement,
        "source star-export information required by REQ-019",
      );
      continue;
    }
    for (const exportedSymbol of exportedSymbols) {
      const resolvedSymbol = resolvedValueSymbol(
        analysis,
        exportedSymbol,
        statement,
        "source star-export information required by REQ-019",
      );
      if (
        resolvedSymbol === undefined ||
        (resolvedSymbol.flags & ts.SymbolFlags.Value) === 0 ||
        exportedSymbol.getName() === "default"
      ) {
        continue;
      }
      violations.push(
        diagnosticAt(
          sourceFile,
          displayPath,
          statement.getStart(sourceFile),
          `Source star export "${exportedSymbol.getName()}" must not pass an imported value through unchanged.`,
        ),
      );
    }
  }
  return violations;
}

function importedBindingViolations(analysis, selectedFile) {
  const { sourceFile, displayPath } = selectedFile;
  const { checker } = analysis;
  const importBindings = importBindingsIn(sourceFile, checker);
  const variableDeclarations = localVariableDeclarations(sourceFile, checker);
  const allReferences = referencesBySymbol(sourceFile, checker);
  const passthroughs = passthroughExportsIn(
    sourceFile,
    checker,
    importBindings,
    variableDeclarations,
    analysis,
  );
  const allowedLocalReferences = new Map();

  for (const passthrough of passthroughs) {
    for (const symbol of passthrough.localSymbols) {
      const references = allowedLocalReferences.get(symbol) ?? new Set();
      for (const reference of passthrough.localReferences) {
        const referenceSymbol = symbolForReference(checker, reference);
        if (referenceSymbol === symbol) {
          references.add(reference);
        }
      }
      allowedLocalReferences.set(symbol, references);
    }
  }

  const invalidLocalSymbols = new Set();
  for (const [symbol, allowedReferences] of allowedLocalReferences) {
    if (
      !sameReferences(
        allReferences.get(symbol) ?? new Set(),
        allowedReferences,
      )
    ) {
      invalidLocalSymbols.add(symbol);
    }
  }

  const allowedImportReferences = new Map();
  for (const passthrough of passthroughs) {
    if ([...passthrough.localSymbols].some((symbol) => invalidLocalSymbols.has(symbol))) {
      continue;
    }
    for (const symbol of passthrough.importSymbols) {
      const references = allowedImportReferences.get(symbol) ?? new Set();
      for (const reference of passthrough.importReferences) {
        const referenceSymbol = symbolForReference(checker, reference);
        if (referenceSymbol === symbol) {
          references.add(reference);
        }
      }
      allowedImportReferences.set(symbol, references);
    }
  }

  const violations = [];
  for (const [symbol, binding] of importBindings) {
    const allowedReferences = allowedImportReferences.get(symbol) ?? new Set();
    const actualReferences = allReferences.get(symbol) ?? new Set();
    if (
      allowedReferences.size === 0 ||
      !sameReferences(actualReferences, allowedReferences)
    ) {
      continue;
    }
    const resolvedSymbol = resolvedValueSymbol(
      analysis,
      symbol,
      binding.identifier,
      "imported value information required by REQ-019",
    );
    if (
      resolvedSymbol === undefined ||
      (resolvedSymbol.flags & ts.SymbolFlags.Value) === 0
    ) {
      continue;
    }
    violations.push(
      diagnosticAt(
        sourceFile,
        displayPath,
        binding.identifier.getStart(sourceFile),
        `Imported value "${binding.name}" must not be re-exported unchanged or through an export-only wrapper.`,
      ),
    );
  }
  return violations;
}

/** Find REQ-019 imported-value passthroughs in selected TypeScript modules. */
// @see [Tightscript: imported-value findings include their source and requirement ID.](./diagnostics.md#tightscript-req-004)
// @see [Tightscript: import analysis rejects unchanged values and behavior-free export wrappers.](./imported-values.md#tightscript-req-019)
// @see [Tightscript: imported-value findings retain the source and rule details required of every diagnostic.](./diagnostics.md#tightscript-prop-req-004-01)
// @see [Tightscript: import analysis follows aliases and nested wrappers to identify passthroughs.](./imported-values.md#tightscript-prop-req-019-01)
export function findImportedValueViolations(analysis) {
  const violations = [];
  for (const selectedFile of analysis.sourceFiles) {
    if (analysis.checker !== undefined) {
      violations.push(...importedBindingViolations(analysis, selectedFile));
      violations.push(...sourceReexportViolations(analysis, selectedFile));
    }
  }
  return violations;
}
