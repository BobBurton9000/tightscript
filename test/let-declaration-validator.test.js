import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { findLetDeclarationViolations } from "../bin/let-declaration-validator.js";

const source = `let ordinary = 1, another = 2;
var legacy = 3;
const immutable = 4;
for (let index = 0; index < 1; index++) {}
for (let value of []) {}
for (let key in {}) {}
`;

test("let declarations in ordinary and loop bindings report REQ-009 at the keyword", () => {
  const sourceFile = ts.createSourceFile(
    "src/example.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const violations = findLetDeclarationViolations([
    { sourceFile, displayPath: "src/example.ts" },
  ]);

  assert.deepEqual(
    violations.map(({ filePath, line, column, requirementId, message }) => ({
      filePath,
      line,
      column,
      requirementId,
      message,
    })),
    [
      {
        filePath: "src/example.ts",
        line: 1,
        column: 1,
        requirementId: "REQ-009",
        message: "`let` declarations are not permitted.",
      },
      {
        filePath: "src/example.ts",
        line: 4,
        column: 6,
        requirementId: "REQ-009",
        message: "`let` declarations are not permitted.",
      },
      {
        filePath: "src/example.ts",
        line: 5,
        column: 6,
        requirementId: "REQ-009",
        message: "`let` declarations are not permitted.",
      },
      {
        filePath: "src/example.ts",
        line: 6,
        column: 6,
        requirementId: "REQ-009",
        message: "`let` declarations are not permitted.",
      },
    ],
  );
});
