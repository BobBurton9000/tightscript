import ts from "typescript";

const REPEATED_STRING_REQUIREMENT_ID = "REQ-034";
const MINIMUM_STRING_CODE_POINTS = 3;
const MINIMUM_STRING_OCCURRENCES = 3;
const TYPEOF_COMPARISON_OPERATORS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

function isStringLiteralNode(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function expressionWithoutParentheses(node) {
  let expression = node;
  while (
    ts.isParenthesizedExpression(expression.parent) &&
    expression.parent.expression === expression
  ) {
    expression = expression.parent;
  }
  return expression;
}

function isPropertyOrMethodDeclaration(node) {
  return (
    ts.isPropertyAssignment(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isMethodSignature(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

function isPropertyOrMethodKey(node) {
  const expression = expressionWithoutParentheses(node);
  const parent = expression.parent;
  if (
    parent !== undefined &&
    isPropertyOrMethodDeclaration(parent) &&
    parent.name === expression
  ) {
    return true;
  }
  if (parent !== undefined && ts.isBindingElement(parent)) {
    if (parent.propertyName === expression) {
      return true;
    }
  }
  if (
    parent !== undefined &&
    ts.isComputedPropertyName(parent) &&
    isPropertyOrMethodDeclaration(parent.parent) &&
    parent.parent.name === parent
  ) {
    return true;
  }
  return (
    parent !== undefined &&
    ts.isElementAccessExpression(parent) &&
    parent.argumentExpression === expression
  );
}

function isStaticModuleSpecifier(node) {
  const parent = node.parent;
  return ts.isImportDeclaration(parent) && parent.moduleSpecifier === node;
}

function isDynamicImportModuleSpecifier(node) {
  const expression = expressionWithoutParentheses(node);
  const parent = expression.parent;
  return (
    ts.isCallExpression(parent) &&
    parent.expression.kind === ts.SyntaxKind.ImportKeyword &&
    parent.arguments[0] === expression
  );
}

function isRequireArgument(node) {
  const expression = expressionWithoutParentheses(node);
  const parent = expression.parent;
  return (
    ts.isCallExpression(parent) &&
    ts.isIdentifier(parent.expression) &&
    parent.expression.text === "require" &&
    parent.arguments.some((argument) => argument === expression)
  );
}

function isTypeofComparison(node) {
  const expression = expressionWithoutParentheses(node);
  const comparison = expression.parent;
  if (
    !ts.isBinaryExpression(comparison) ||
    !TYPEOF_COMPARISON_OPERATORS.has(comparison.operatorToken.kind)
  ) {
    return false;
  }

  const leftOperand = expressionWithoutParentheses(comparison.left);
  const rightOperand = expressionWithoutParentheses(comparison.right);
  return (
    (leftOperand === expression && ts.isTypeOfExpression(rightOperand)) ||
    (rightOperand === expression && ts.isTypeOfExpression(leftOperand))
  );
}

function isInsideEnumMember(node) {
  let parent = node.parent;
  while (parent !== undefined && !ts.isSourceFile(parent)) {
    if (ts.isEnumMember(parent)) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

function isEligibleStringLiteral(node) {
  if (!isStringLiteralNode(node)) {
    return false;
  }

  const parent = node.parent;
  if (parent !== undefined && ts.isLiteralTypeNode(parent)) {
    return false;
  }
  return !(
    isStaticModuleSpecifier(node) ||
    isDynamicImportModuleSpecifier(node) ||
    isRequireArgument(node) ||
    isPropertyOrMethodKey(node) ||
    isInsideEnumMember(node) ||
    isTypeofComparison(node)
  );
}

function diagnosticFor(selectedFile, node, value) {
  const { sourceFile, displayPath } = selectedFile;
  const location = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );
  return {
    filePath: displayPath,
    line: location.line + 1,
    column: location.character + 1,
    requirementId: REPEATED_STRING_REQUIREMENT_ID,
    message: `String literal ${JSON.stringify(value)} occurs at least three times across selected files; replace the occurrences with one named constant.`,
    start: node.getStart(sourceFile),
  };
}

function clientDirectiveNodesFrom(sourceFile) {
  const directiveNodes = new Set();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteral(statement.expression)
    ) {
      break;
    }
    if (statement.expression.text === "use client") {
      directiveNodes.add(statement.expression);
    }
  }
  return directiveNodes;
}

function stringOccurrencesFrom(sourceFiles, frameworkContext) {
  const occurrencesByValue = new Map();

  for (const selectedFile of sourceFiles) {
    const clientDirectiveNodes =
      frameworkContext?.next?.status === "supported"
        ? clientDirectiveNodesFrom(selectedFile.sourceFile)
        : new Set();

    function visit(node) {
      if (
        !clientDirectiveNodes.has(node) &&
        isEligibleStringLiteral(node)
      ) {
        const occurrences = occurrencesByValue.get(node.text) ?? [];
        occurrences.push({ selectedFile, node });
        occurrencesByValue.set(node.text, occurrences);
      }
      ts.forEachChild(node, visit);
    }

    visit(selectedFile.sourceFile);
  }

  return occurrencesByValue;
}

/** Find REQ-034 violations across every selected source file. */
// @see [Tightscript: repeated-string findings include their source and requirement ID.](./diagnostics.md#tightscript-req-004)
// @see [Tightscript: string analysis reports all eligible values meeting the global threshold.](./repeated-strings.md#tightscript-req-034)
// @see [Tightscript: string analysis omits the literal forms excluded by policy.](./repeated-strings.md#tightscript-req-035)
// @see [Tightscript: string analysis excludes direct comparisons against unary `typeof`.](./repeated-strings.md#tightscript-req-036)
// @see [Tightscript: repeated-string findings retain the source and rule details required of every diagnostic.](./diagnostics.md#tightscript-prop-req-004-01)
// @see [Tightscript: string analysis counts eligible literals across all selected files.](./repeated-strings.md#tightscript-prop-req-034-01)
// @see [nextjs-client-directive-exemption: This validator excludes only qualifying client directives from repeated-string counts.](./repeated-strings.md#nextjs-client-directive-exemption-req-001)
// @see [nextjs-client-directive-exemption: This validator bases directive eligibility on supported Next.js context and position, not route classification.](./repeated-strings.md#nextjs-client-directive-exemption-req-002)
// @see [nextjs-client-directive-exemption: This validator counts every non-qualifying `use client` occurrence under the existing policy.](./repeated-strings.md#nextjs-client-directive-exemption-req-003)
// @see [nextjs-client-directive-exemption: This validator preserves existing thresholds, cross-file counting, and literal exclusions.](./repeated-strings.md#nextjs-client-directive-exemption-req-004)
// @see [nextjs-client-directive-exemption: This validator processes only files already selected for analysis.](./repeated-strings.md#nextjs-client-directive-exemption-req-005)
// @see [nextjs-client-directive-exemption: This validator enforces the tested directive-eligibility invariant.](./repeated-strings.md#nextjs-client-directive-exemption-prop-req-001-01)
// @see [nextjs-client-directive-exemption: This validator preserves counting boundaries over the selected source set.](./repeated-strings.md#nextjs-client-directive-exemption-prop-req-004-01)
export function findRepeatedStringViolations(analysis, frameworkContext) {
  const violations = [];
  const occurrencesByValue = stringOccurrencesFrom(
    analysis.sourceFiles,
    frameworkContext,
  );

  for (const [value, occurrences] of occurrencesByValue) {
    if (
      Array.from(value).length < MINIMUM_STRING_CODE_POINTS ||
      occurrences.length < MINIMUM_STRING_OCCURRENCES
    ) {
      continue;
    }
    for (const occurrence of occurrences) {
      violations.push(
        diagnosticFor(occurrence.selectedFile, occurrence.node, value),
      );
    }
  }

  return violations;
}
