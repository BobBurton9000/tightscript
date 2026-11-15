import ts from "typescript";

const REQUIREMENT_ID = "REQ-009";
const MESSAGE = "`let` declarations are not permitted.";

/** Find every `let` declaration list in the selected TypeScript source files. */
export function findLetDeclarationViolations(sourceFiles) {
  const violations = [];

  for (const selectedFile of sourceFiles) {
    const { sourceFile, displayPath } = selectedFile;

    function visit(node) {
      if (
        ts.isVariableDeclarationList(node) &&
        (node.flags & ts.NodeFlags.Let) !== 0
      ) {
        const start = node.getStart(sourceFile);
        const location = sourceFile.getLineAndCharacterOfPosition(start);
        violations.push({
          filePath: displayPath,
          line: location.line + 1,
          column: location.character + 1,
          requirementId: REQUIREMENT_ID,
          message: MESSAGE,
          start,
        });
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return violations;
}
