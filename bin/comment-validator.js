import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import ts from "typescript";

const COMMENT_REQUIREMENT_ID = "REQ-010";
const INVALID_LINK_REQUIREMENT_ID = "REQ-012";
const HEADING_REQUIREMENT_ID = "REQ-013";
const SUPPRESSION_REQUIREMENT_ID = "REQ-014";
const ACCEPTED_SEE_LINK = /^@see\s+\[[^\]\r\n]+\]\((?<target><[^>\r\n]+>|[^()\s]+)\)$/u;
const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);
const INVALID_LINK_TARGET_CODES = new Set(["ENOENT", "ENOTDIR", "ELOOP"]);
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

function repositoryContextFrom(currentDirectory) {
  const rootOutput = execFileSync(
    "git",
    ["rev-parse", "--show-toplevel"],
    { cwd: currentDirectory, encoding: "utf8" },
  );
  const rootPath = rootOutput.replace(/\r?\n$/u, "");
  const repositoryRoot = realpathSync(rootPath);
  const trackedPathOutput = execFileSync("git", ["ls-files", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });

  return {
    repositoryRoot,
    trackedPaths: new Set(trackedPathOutput.split("\0").filter(Boolean)),
  };
}

function pathIsWithin(directoryPath, candidatePath) {
  const relativePath = relative(directoryPath, candidatePath);

  return (
    relativePath === "" ||
    (!isAbsolute(relativePath) &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`))
  );
}

function visibleHeadingTextFrom(headingText) {
  return headingText
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/<[^>]*>/gu, "")
    .replace(/`+/gu, "")
    .replace(/[*_~]/gu, "");
}

function headingAnchorFrom(headingText) {
  return visibleHeadingTextFrom(headingText)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s-]/gu, "")
    .trim()
    .replace(/\s/gu, "-");
}

function headingAnchorsFrom(markdownContents) {
  const lines = markdownContents.replace(/\r\n?/gu, "\n").split("\n");
  const anchors = new Set();
  const anchorCounts = new Map();
  let fenceCharacter;
  let fenceLength = 0;

  function addHeading(headingText) {
    const baseAnchor = headingAnchorFrom(headingText);
    if (baseAnchor.length === 0) {
      return;
    }

    const duplicateCount = anchorCounts.get(baseAnchor) ?? 0;
    anchorCounts.set(baseAnchor, duplicateCount + 1);
    anchors.add(duplicateCount === 0 ? baseAnchor : `${baseAnchor}-${duplicateCount}`);
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/u);
    if (fenceCharacter !== undefined) {
      if (
        fenceMatch !== null &&
        fenceMatch[1][0] === fenceCharacter &&
        fenceMatch[1].length >= fenceLength
      ) {
        fenceCharacter = undefined;
      }
      continue;
    }
    if (fenceMatch !== null) {
      fenceCharacter = fenceMatch[1][0];
      fenceLength = fenceMatch[1].length;
      continue;
    }

    const atxHeading = line.match(/^ {0,3}#{1,6}(?:[\t ]+|$)(.*)$/u);
    if (atxHeading !== null) {
      addHeading(atxHeading[1].replace(/[\t ]+#+[\t ]*$/u, ""));
      continue;
    }

    const setextUnderline = lines[lineIndex + 1]?.match(/^ {0,3}(?:=+|-+)[\t ]*$/u);
    if (line.trim().length > 0 && setextUnderline !== undefined) {
      addHeading(line.trim());
      lineIndex += 1;
    }
  }

  return anchors;
}

function linkFailure(selectedFile, start, requirementId, message) {
  return [commentViolation(selectedFile, start, requirementId, message)];
}

function linkViolations(selectedFile, start, linkTarget, repositoryContext) {
  const unwrappedTarget = linkTarget.startsWith("<")
    ? linkTarget.slice(1, -1)
    : linkTarget;
  const fragmentIndex = unwrappedTarget.indexOf("#");
  const targetPathText =
    fragmentIndex < 0 ? unwrappedTarget : unwrappedTarget.slice(0, fragmentIndex);
  const fragmentText =
    fragmentIndex < 0 ? undefined : unwrappedTarget.slice(fragmentIndex + 1);
  let targetPath;

  try {
    targetPath = decodeURIComponent(targetPathText);
  } catch {
    return linkFailure(
      selectedFile,
      start,
      INVALID_LINK_REQUIREMENT_ID,
      "The @see link must resolve to a tracked Markdown file inside the repository.",
    );
  }

  const targetPathFromSource = resolve(dirname(selectedFile.filePath), targetPath);
  let finalTargetPath;
  try {
    finalTargetPath = realpathSync(targetPathFromSource);
  } catch (error) {
    if (INVALID_LINK_TARGET_CODES.has(error.code)) {
      return linkFailure(
        selectedFile,
        start,
        INVALID_LINK_REQUIREMENT_ID,
        "The @see link must resolve to a tracked Markdown file inside the repository.",
      );
    }
    throw error;
  }

  const isMarkdownFile = MARKDOWN_EXTENSIONS.has(extname(finalTargetPath).toLowerCase());
  if (!pathIsWithin(repositoryContext.repositoryRoot, finalTargetPath) || !isMarkdownFile) {
    return linkFailure(
      selectedFile,
      start,
      INVALID_LINK_REQUIREMENT_ID,
      "The @see link must resolve to a tracked Markdown file inside the repository.",
    );
  }

  let targetStats;
  try {
    targetStats = statSync(finalTargetPath);
  } catch (error) {
    if (INVALID_LINK_TARGET_CODES.has(error.code)) {
      return linkFailure(
        selectedFile,
        start,
        INVALID_LINK_REQUIREMENT_ID,
        "The @see link must resolve to a tracked Markdown file inside the repository.",
      );
    }
    throw error;
  }
  if (!targetStats.isFile()) {
    return linkFailure(
      selectedFile,
      start,
      INVALID_LINK_REQUIREMENT_ID,
      "The @see link must resolve to a tracked Markdown file inside the repository.",
    );
  }

  const repositoryRelativePath = relative(
    repositoryContext.repositoryRoot,
    finalTargetPath,
  ).split(sep).join("/");
  if (!repositoryContext.trackedPaths.has(repositoryRelativePath)) {
    return linkFailure(
      selectedFile,
      start,
      INVALID_LINK_REQUIREMENT_ID,
      "The @see link must resolve to a tracked Markdown file inside the repository.",
    );
  }

  if (fragmentText === undefined) {
    return [];
  }

  let fragment;
  try {
    fragment = decodeURIComponent(fragmentText);
  } catch {
    return linkFailure(
      selectedFile,
      start,
      HEADING_REQUIREMENT_ID,
      "The @see heading fragment must match a GitHub-generated heading anchor.",
    );
  }

  const markdownContents = readFileSync(finalTargetPath, "utf8");
  if (!headingAnchorsFrom(markdownContents).has(fragment)) {
    return linkFailure(
      selectedFile,
      start,
      HEADING_REQUIREMENT_ID,
      "The @see heading fragment must match a GitHub-generated heading anchor.",
    );
  }

  return [];
}

function seeTargetFrom(contents) {
  return ACCEPTED_SEE_LINK.exec(contents)?.groups?.target;
}

function commentViolations(selectedFile, getRepositoryContext) {
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

    const linkTarget = seeTargetFrom(contents);
    if (linkTarget === undefined) {
      violations.push(
        commentViolation(
          selectedFile,
          start,
          COMMENT_REQUIREMENT_ID,
          "Comments must contain only one @see Markdown link and no additional content.",
        ),
      );
      continue;
    }

    violations.push(
      ...linkViolations(selectedFile, start, linkTarget, getRepositoryContext()),
    );
  }

  return violations;
}

/** Find REQ-010 through REQ-014 comment and link-policy violations. */
// @see [Tightscript: comment findings include their file, source location, and requirement ID.](./diagnostics.md#tightscript-req-004)
// @see [Tightscript: comment validation accepts only one `@see` Markdown link per comment.](./comment-policy.md#tightscript-req-010)
// @see [Tightscript: link validation resolves from source files and requires tracked repository Markdown.](./comment-policy.md#tightscript-req-011)
// @see [Tightscript: link validation rejects missing, external, non-Markdown, and untracked targets.](./comment-policy.md#tightscript-req-012)
// @see [Tightscript: link validation checks GitHub-compatible heading anchors and duplicate suffixes.](./comment-policy.md#tightscript-req-013)
// @see [Tightscript: comment validation reports suppressions without hiding other violations.](./comment-policy.md#tightscript-req-014)
// @see [Tightscript: comment findings retain the source and rule details required of every diagnostic.](./diagnostics.md#tightscript-prop-req-004-01)
// @see [Tightscript: comment validation enforces the comment, link-target, and suppression invariants.](./comment-policy.md#tightscript-prop-req-010-01)
// @see [nextjs-client-directive-exemption: Comment validation rejects suppression directives that could override the fixed exception.](./repeated-strings.md#nextjs-client-directive-exemption-req-006)
// @see [nextjs-client-directive-exemption: Comment validation keeps the directive exception outside suppression mechanisms.](./repeated-strings.md#nextjs-client-directive-exemption-prop-req-001-01)
export function findCommentViolations(analysis) {
  const violations = [];
  let repositoryContext;

  function getRepositoryContext() {
    repositoryContext ??= repositoryContextFrom(process.cwd());
    return repositoryContext;
  }

  for (const selectedFile of analysis.sourceFiles) {
    violations.push(...commentViolations(selectedFile, getRepositoryContext));
  }

  return violations;
}
