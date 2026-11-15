import ts from "typescript";

const ANONYMOUS_OBJECT_REQUIREMENT_ID = "REQ-027";
const INTERSECTION_REQUIREMENT_ID = "REQ-028";

function diagnosticAt(sourceFile, filePath, node, requirementId, message) {
  const start = node.getStart(sourceFile);
  const location = sourceFile.getLineAndCharacterOfPosition(start);
  return {
    filePath,
    line: location.line + 1,
    column: location.character + 1,
    requirementId,
    message,
    start,
  };
}

function anonymousObjectViolations(
  selectedFile,
  typeNode,
  reportedTypeLiterals,
) {
  const { sourceFile, displayPath } = selectedFile;
  const violations = [];

  function visit(node) {
    if (ts.isTypeLiteralNode(node) && !reportedTypeLiterals.has(node)) {
      reportedTypeLiterals.add(node);
      violations.push(
        diagnosticAt(
          sourceFile,
          displayPath,
          node,
          ANONYMOUS_OBJECT_REQUIREMENT_ID,
          "Function parameter and return annotations must use named object types instead of anonymous object type literals.",
        ),
      );
    }
    ts.forEachChild(node, visit);
  }

  visit(typeNode);
  return violations;
}

function topLevelType(typeNode) {
  let currentType = typeNode;
  while (ts.isParenthesizedTypeNode(currentType)) {
    currentType = currentType.type;
  }
  return currentType;
}

function intersectionViolation(selectedFile, typeNode) {
  const { sourceFile, displayPath } = selectedFile;
  const intersectionType = topLevelType(typeNode);
  if (!ts.isIntersectionTypeNode(intersectionType)) {
    return undefined;
  }

  return diagnosticAt(
    sourceFile,
    displayPath,
    intersectionType,
    INTERSECTION_REQUIREMENT_ID,
    "Property and function-parameter type annotations must not use top-level intersection types.",
  );
}

/** Find REQ-027 and REQ-028 violations in selected source annotations. */
export function findTypeAnnotationViolations(sourceFiles) {
  const violations = [];

  for (const selectedFile of sourceFiles) {
    const { sourceFile } = selectedFile;
    const reportedTypeLiterals = new Set();

    function visit(node) {
      if (ts.isParameter(node) && node.type !== undefined) {
        violations.push(
          ...anonymousObjectViolations(
            selectedFile,
            node.type,
            reportedTypeLiterals,
          ),
        );
        const violation = intersectionViolation(selectedFile, node.type);
        if (violation !== undefined) {
          violations.push(violation);
        }
      }

      if (ts.isFunctionLike(node) && node.type !== undefined) {
        violations.push(
          ...anonymousObjectViolations(
            selectedFile,
            node.type,
            reportedTypeLiterals,
          ),
        );
      }

      if (
        (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) &&
        node.type !== undefined
      ) {
        const violation = intersectionViolation(selectedFile, node.type);
        if (violation !== undefined) {
          violations.push(violation);
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return violations;
}
