import ts from "typescript";

const REQUIREMENT_ID = "REQ-009";
const MESSAGE = "`let` declarations are not permitted.";

/** Find every `let` declaration list in the selected TypeScript source files. */
// @see [Tightscript: let findings include their file, source location, and requirement ID.](./diagnostics.md#tightscript-req-004)
// @see [Tightscript: let-declaration analysis flags ordinary and loop bindings declared with `let`.](./let-declarations.md#tightscript-req-009)
// @see [Tightscript: let findings retain the source and rule details required of every diagnostic.](./diagnostics.md#tightscript-prop-req-004-01)
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
