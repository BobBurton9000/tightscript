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

/** Find REQ-020 and REQ-021 violations in the selected TypeScript source files. */
export function findExportViolations(sourceFiles) {
  const violations = [];

  for (const selectedFile of sourceFiles) {
    const localValues = localValueDeclarations(selectedFile.sourceFile);
    violations.push(...localExportListViolations(selectedFile, localValues));
    violations.push(...exportedObjectViolations(selectedFile, localValues));
  }

  return violations;
}
