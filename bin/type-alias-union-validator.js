import ts from "typescript";

const TYPE_ALIAS_REQUIREMENT_ID = "REQ-029";
const UNION_TYPE_REQUIREMENT_ID = "REQ-030";

function diagnosticAt(selectedFile, node, requirementId, message) {
  const { sourceFile, displayPath } = selectedFile;
  const start = node.getStart(sourceFile);
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

/** Find every type-alias declaration and union type in selected source files. */
// @see [Tightscript: type-syntax findings include their source and requirement ID.](./diagnostics.md#tightscript-req-004)
// @see [Tightscript: type-syntax analysis rejects every type alias declaration.](./type-syntax.md#tightscript-req-029)
// @see [Tightscript: type-syntax analysis rejects every union type node.](./type-syntax.md#tightscript-req-030)
// @see [Tightscript: type-syntax findings retain the source and rule details required of every diagnostic.](./diagnostics.md#tightscript-prop-req-004-01)
export function findTypeAliasAndUnionViolations(sourceFiles) {
  const violations = [];

  for (const selectedFile of sourceFiles) {
    const { sourceFile } = selectedFile;

    function visit(node) {
      if (ts.isTypeAliasDeclaration(node)) {
        violations.push(
          diagnosticAt(
            selectedFile,
            node,
            TYPE_ALIAS_REQUIREMENT_ID,
            "Type alias declarations are not permitted.",
          ),
        );
      }

      if (ts.isUnionTypeNode(node)) {
        violations.push(
          diagnosticAt(
            selectedFile,
            node,
            UNION_TYPE_REQUIREMENT_ID,
            "Union type syntax is not permitted.",
          ),
        );
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return violations;
}
