import ts from "typescript";

const FUNCTION_NAME_REQUIREMENT_ID = "REQ-031";
const ELSE_BRANCH_REQUIREMENT_ID = "REQ-032";
const PARAMETER_LAYOUT_REQUIREMENT_ID = "REQ-033";

function diagnosticAt(
  selectedFile,
  node,
  requirementId,
  message,
  start = node.getStart(selectedFile.sourceFile),
) {
  const { sourceFile, displayPath } = selectedFile;
  const location = sourceFile.getLineAndCharacterOfPosition(start);
  return {
    filePath: displayPath,
    line: location.line + 1,
    column: location.character + 1,
    requirementId,
    message,
    start,
  };
}

function staticNameText(name) {
  if (name === undefined || name === null) {
    return undefined;
  }
  if (ts.isIdentifier(name)) {
    return name.text;
  }
  if (ts.isPrivateIdentifier(name)) {
    return name.text.replace(/^#/, "");
  }
  if (
    ts.isStringLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name)
  ) {
    return name.text;
  }
  if (ts.isComputedPropertyName(name)) {
    return staticNameText(name.expression);
  }
  return undefined;
}

function hasCallSignature(node, checker) {
  if (node === undefined || checker === undefined) {
    return false;
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    return true;
  }

  try {
    return checker.getTypeAtLocation(node).getCallSignatures().length > 0;
  } catch {
    return false;
  }
}

function functionNameViolation(selectedFile, node, name) {
  if (name === undefined || !name.startsWith("get")) {
    return undefined;
  }

  return diagnosticAt(
    selectedFile,
    node,
    FUNCTION_NAME_REQUIREMENT_ID,
    `Function or method name ${JSON.stringify(name)} must not begin with the lowercase prefix "get".`,
  );
}

function functionLikeNode(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isFunctionTypeNode(node) ||
    ts.isConstructorTypeNode(node) ||
    ts.isMethodSignature(node) ||
    ts.isCallSignatureDeclaration(node) ||
    ts.isConstructSignatureDeclaration(node)
  );
}

function parenthesisTokens(sourceFile, node) {
  let openingParenthesis;
  let closingParenthesis;

  for (const child of node.getChildren(sourceFile)) {
    if (
      openingParenthesis === undefined &&
      child.kind === ts.SyntaxKind.OpenParenToken
    ) {
      openingParenthesis = child;
    }
    if (child.kind === ts.SyntaxKind.CloseParenToken) {
      closingParenthesis = child;
    }
  }

  return { openingParenthesis, closingParenthesis };
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
}

function parameterLayoutViolation(selectedFile, node) {
  const { sourceFile } = selectedFile;
  if (node.parameters.length < 2) {
    return undefined;
  }

  const { openingParenthesis, closingParenthesis } = parenthesisTokens(
    sourceFile,
    node,
  );
  if (
    openingParenthesis === undefined ||
    closingParenthesis === undefined
  ) {
    return undefined;
  }

  const parameterLines = node.parameters.map((parameter) =>
    lineOf(sourceFile, parameter),
  );
  const parameterLineSet = new Set(parameterLines);
  let offendingNode;

  if (parameterLineSet.size !== parameterLines.length) {
    const seenLines = new Set();
    const repeatedParameter = node.parameters.find((parameter, index) => {
      const line = parameterLines[index];
      if (seenLines.has(line)) {
        return true;
      }
      seenLines.add(line);
      return false;
    });
    offendingNode = repeatedParameter;
  }

  if (
    offendingNode === undefined &&
    parameterLineSet.has(lineOf(sourceFile, openingParenthesis))
  ) {
    offendingNode = openingParenthesis;
  }
  if (
    offendingNode === undefined &&
    parameterLineSet.has(lineOf(sourceFile, closingParenthesis))
  ) {
    offendingNode = closingParenthesis;
  }
  if (offendingNode === undefined) {
    return undefined;
  }

  return diagnosticAt(
    selectedFile,
    offendingNode,
    PARAMETER_LAYOUT_REQUIREMENT_ID,
    "Functions with multiple parameters must put each parameter on its own line and place the opening and closing parentheses on separate lines from the parameters.",
  );
}

function syntaxStyleViolations(selectedFile, checker) {
  const { sourceFile } = selectedFile;
  const violations = [];

  function visit(node) {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isMethodSignature(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)
    ) {
      const violation = functionNameViolation(
        selectedFile,
        node,
        staticNameText(node.name),
      );
      if (violation !== undefined) {
        violations.push(violation);
      }
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      hasCallSignature(node, checker)
    ) {
      const violation = functionNameViolation(
        selectedFile,
        node,
        node.name.text,
      );
      if (violation !== undefined) {
        violations.push(violation);
      }
    } else if (
      ts.isPropertyAssignment(node) &&
      hasCallSignature(node.initializer, checker)
    ) {
      const violation = functionNameViolation(
        selectedFile,
        node,
        staticNameText(node.name),
      );
      if (violation !== undefined) {
        violations.push(violation);
      }
    } else if (
      ts.isPropertySignature(node) &&
      hasCallSignature(node, checker)
    ) {
      const violation = functionNameViolation(
        selectedFile,
        node,
        staticNameText(node.name),
      );
      if (violation !== undefined) {
        violations.push(violation);
      }
    }

    if (ts.isIfStatement(node) && node.elseStatement !== undefined) {
      const elseKeyword = node
        .getChildren(sourceFile)
        .find((child) => child.kind === ts.SyntaxKind.ElseKeyword);
      if (elseKeyword !== undefined) {
        violations.push(
          diagnosticAt(
            selectedFile,
            elseKeyword,
            ELSE_BRANCH_REQUIREMENT_ID,
            "else and else if branches are not permitted.",
          ),
        );
      }
    }

    if (functionLikeNode(node)) {
      const violation = parameterLayoutViolation(selectedFile, node);
      if (violation !== undefined) {
        violations.push(violation);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

/** Find REQ-031, REQ-032, and REQ-033 violations in selected source files. */
export function findSyntaxStyleViolations(analysis) {
  const violations = [];

  for (const selectedFile of analysis.sourceFiles) {
    violations.push(...syntaxStyleViolations(selectedFile, analysis.checker));
  }

  return violations;
}
