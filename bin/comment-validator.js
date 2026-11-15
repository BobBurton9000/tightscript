import ts from "typescript";

const COMMENT_REQUIREMENT_ID = "REQ-010";
const SUPPRESSION_REQUIREMENT_ID = "REQ-014";
const ACCEPTED_SEE_LINK = /^@see\s+\[[^\]\r\n]+\]\((?:<[^>\r\n]+>|[^()\s]+)\)$/u;
const SUPPRESSION_DIRECTIVE =
  /(?:^|[^\w@])(?:@ts-(?:ignore|expect-error|nocheck)|eslint-disable(?:-(?:next-line|line))?|tslint\s*:\s*(?:disable|ignore)|biome-ignore(?:-(?:next-line|start|end))?|tightscript-(?:disable|ignore|suppress|off))(?![\w-])/u;

function commentContentsFrom(tokenText, tokenKind) {
  const hasSingleLineComment =
    tokenKind === ts.SyntaxKind.SingleLineCommentTrivia;
  const endsWithCommentDelimiter = tokenText.endsWith("*/");
  const contents = hasSingleLineComment
    ? tokenText.slice(2)
    : tokenText.slice(2, endsWithCommentDelimiter ? -2 : undefined);

  return contents
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/^\*[\t ]?/u, "").trim())
    .filter((line) => line.length > 0)
    .join(" ");
}

function commentViolation(selectedFile, start, requirementId, message) {
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

function commentViolations(selectedFile) {
  const { sourceFile } = selectedFile;
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    sourceFile.languageVariant,
    sourceFile.text,
  );
  const violations = [];

  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
    const tokenKind = scanner.getToken();
    if (
      tokenKind !== ts.SyntaxKind.SingleLineCommentTrivia &&
      tokenKind !== ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      continue;
    }

    const start = scanner.getTokenPos();
    const tokenText = sourceFile.text.slice(start, scanner.getTextPos());
    const contents = commentContentsFrom(tokenText, tokenKind);

    if (SUPPRESSION_DIRECTIVE.test(contents)) {
      violations.push(
        commentViolation(
          selectedFile,
          start,
          SUPPRESSION_REQUIREMENT_ID,
          "Suppression directives are not permitted; comments must not suppress policy violations.",
        ),
      );
      continue;
    }

    if (!ACCEPTED_SEE_LINK.test(contents)) {
      violations.push(
        commentViolation(
          selectedFile,
          start,
          COMMENT_REQUIREMENT_ID,
          "Comments must contain only one @see Markdown link and no additional content.",
        ),
      );
    }
  }

  return violations;
}

/** Find REQ-010 and REQ-014 comment-policy violations in selected files. */
export function findCommentViolations(analysis) {
  const violations = [];

  for (const selectedFile of analysis.sourceFiles) {
    violations.push(...commentViolations(selectedFile));
  }

  return violations;
}
