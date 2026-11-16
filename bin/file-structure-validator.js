import { basename, extname } from "node:path";
import ts from "typescript";

const MAX_EFFECTIVE_LINES = 600;

function isExported(node) {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }

  return (ts.getModifiers(node) ?? []).some(
    (modifier) =>
      modifier.kind === ts.SyntaxKind.ExportKeyword ||
      modifier.kind === ts.SyntaxKind.DefaultKeyword,
  );
}

function localExportNames(sourceFile) {
  const names = new Set();

  for (const statement of sourceFile.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier === undefined &&
      statement.exportClause !== undefined &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        const localName = element.propertyName ?? element.name;
        if (ts.isIdentifier(localName)) {
          names.add(localName.text);
        }
      }
    } else if (
      ts.isExportAssignment(statement) &&
      ts.isIdentifier(statement.expression)
    ) {
      names.add(statement.expression.text);
    }
  }

  return names;
}

function locationAt(sourceFile, position) {
  const location = sourceFile.getLineAndCharacterOfPosition(position);
  return { line: location.line + 1, column: location.character + 1 };
}

function exportedBasenameViolations(selectedFile) {
  const { sourceFile, displayPath } = selectedFile;
  const fileName = basename(displayPath);
  const extension = extname(fileName);
  const expectedName = fileName.slice(0, fileName.length - extension.length);
  if (expectedName === "index") {
    return [];
  }

  const exportedNames = localExportNames(sourceFile);
  const violations = [];

  function visit(node) {
    if (
      (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) &&
      node.name !== undefined &&
      (isExported(node) ||
        (node.parent === sourceFile && exportedNames.has(node.name.text))) &&
      node.name.text !== expectedName
    ) {
      const position = node.getStart(sourceFile);
      violations.push({
        filePath: displayPath,
        ...locationAt(sourceFile, position),
        requirementId: "REQ-015",
        message: `Exported class or interface "${node.name.text}" must match the file basename "${expectedName}".`,
        start: position,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

function lineStartsAndCount(sourceFile) {
  const text = sourceFile.text;
  if (text.length === 0) {
    return { lineStarts: [], lineCount: 0 };
  }

  const lineStarts = sourceFile.getLineStarts();
  const endsWithLineBreak = /[\r\n\u2028\u2029]$/.test(text);
  return {
    lineStarts,
    lineCount: lineStarts.length - (endsWithLineBreak ? 1 : 0),
  };
}

function rangesInSourceFile(sourceFile, predicate) {
  const ranges = [];

  function visit(node) {
    if (predicate(node)) {
      ranges.push([node.getStart(sourceFile), node.end]);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  ranges.sort((left, right) => left[0] - right[0]);
  return ranges;
}

function commentRanges(sourceFile) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    sourceFile.languageVariant,
    sourceFile.text,
  );
  const ranges = [];

  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
    const token = scanner.getToken();
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      ranges.push([scanner.getTokenPos(), scanner.getTextPos()]);
    }
  }

  return ranges;
}

function intersectsLine(ranges, lineStart, lineEnd) {
  return ranges.some(([start, end]) => start < lineEnd && end > lineStart);
}

function lineContainsOnlyImportSyntax(text, lineStart, lineEnd, importRanges) {
  let rangeIndex = 0;
  let hasNonWhitespace = false;

  for (let position = lineStart; position < lineEnd; position += 1) {
    if (/\s/u.test(text[position])) {
      continue;
    }

    hasNonWhitespace = true;
    while (
      rangeIndex < importRanges.length &&
      importRanges[rangeIndex][1] <= position
    ) {
      rangeIndex += 1;
    }

    const range = importRanges[rangeIndex];
    if (range === undefined || range[0] > position || range[1] <= position) {
      return false;
    }
  }

  return hasNonWhitespace;
}

function effectiveLineOverflow(selectedFile) {
  const { sourceFile, displayPath } = selectedFile;
  const { lineStarts, lineCount } = lineStartsAndCount(sourceFile);
  const importRanges = rangesInSourceFile(
    sourceFile,
    (node) =>
      ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node),
  );
  const comments = commentRanges(sourceFile);
  let effectiveLineCount = 0;

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const lineStart = lineStarts[lineIndex];
    let lineEnd =
      lineIndex + 1 < lineStarts.length
        ? lineStarts[lineIndex + 1]
        : sourceFile.text.length;
    while (
      lineEnd > lineStart &&
      /[\r\n\u2028\u2029]/u.test(sourceFile.text[lineEnd - 1])
    ) {
      lineEnd -= 1;
    }

    const importOnly =
      !intersectsLine(comments, lineStart, lineEnd) &&
      lineContainsOnlyImportSyntax(
        sourceFile.text,
        lineStart,
        lineEnd,
        importRanges,
      );
    if (importOnly) {
      continue;
    }

    effectiveLineCount += 1;
    if (effectiveLineCount === MAX_EFFECTIVE_LINES + 1) {
      return {
        filePath: displayPath,
        ...locationAt(sourceFile, lineStart),
        requirementId: "REQ-016",
        message: `Files must not exceed ${MAX_EFFECTIVE_LINES} effective lines.`,
        start: lineStart,
      };
    }
  }

  return undefined;
}

function declarationCountViolation(selectedFile) {
  const { sourceFile, displayPath } = selectedFile;
  const declarations = [];

  function visit(node) {
    if (
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node) ||
      ts.isInterfaceDeclaration(node)
    ) {
      declarations.push(node);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  if (declarations.length <= 1) {
    return undefined;
  }

  const position = declarations[1].getStart(sourceFile);
  return {
    filePath: displayPath,
    ...locationAt(sourceFile, position),
    requirementId: "REQ-017",
    message:
      "A source file may contain at most one class declaration, class expression, or interface.",
    start: position,
  };
}

/** Find exported-name, effective-line-count, and declaration-count violations. */
// @see [Tightscript: file-structure findings include their source and requirement ID.](./diagnostics.md#tightscript-req-004)
// @see [Tightscript: file analysis compares exported named declarations with the file basename.](./file-structure.md#tightscript-req-015)
// @see [Tightscript: file analysis counts effective lines and excludes only import-only lines.](./file-structure.md#tightscript-req-016)
// @see [Tightscript: file analysis rejects a second class, class expression, or interface.](./file-structure.md#tightscript-req-017)
// @see [Tightscript: file-structure findings retain the source and rule details required of every diagnostic.](./diagnostics.md#tightscript-prop-req-004-01)
export function findFileStructureViolations(sourceFiles) {
  const violations = [];

  for (const selectedFile of sourceFiles) {
    violations.push(...exportedBasenameViolations(selectedFile));

    const lineViolation = effectiveLineOverflow(selectedFile);
    if (lineViolation !== undefined) {
      violations.push(lineViolation);
    }

    const declarationViolation = declarationCountViolation(selectedFile);
    if (declarationViolation !== undefined) {
      violations.push(declarationViolation);
    }
  }

  return violations;
}
