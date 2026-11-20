import { lstat, readdir, realpath, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const SKIPPABLE_SYMLINK_ERRORS = new Set(["ELOOP", "ENOENT", "ENOTDIR"]);
const segmentRegexCache = new Map();

function segmentMatches(patternSegment, pathSegment) {
  let expression = segmentRegexCache.get(patternSegment);
  if (expression === undefined) {
    let source = "^";
    for (const character of patternSegment) {
      if (character === "*") {
        source += "[^/]*";
      } else if (character === "?") {
        source += "[^/]";
      } else {
        source += character.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
      }
    }
    expression = new RegExp(`${source}$`);
    segmentRegexCache.set(patternSegment, expression);
  }
  return expression.test(pathSegment);
}

function patternMatchesPath(patternSegments, pathSegments) {
  const results = new Map();
  function matches(patternIndex, pathIndex) {
    const key = `${patternIndex}:${pathIndex}`;
    if (results.has(key)) {
      return results.get(key);
    }

    let result;
    if (patternIndex === patternSegments.length) {
      result = pathIndex === pathSegments.length;
    } else if (patternSegments[patternIndex] === "**") {
      result =
        matches(patternIndex + 1, pathIndex) ||
        (pathIndex < pathSegments.length && matches(patternIndex, pathIndex + 1));
    } else {
      result =
        pathIndex < pathSegments.length &&
        segmentMatches(patternSegments[patternIndex], pathSegments[pathIndex]) &&
        matches(patternIndex + 1, pathIndex + 1);
    }

    results.set(key, result);
    return result;
  }

  return matches(0, 0);
}

function compilePattern(pattern) {
  if (typeof pattern !== "string" || pattern.length === 0 || pattern.startsWith("!")) {
    throw new TypeError("Source-scope patterns must be non-empty positive strings.");
  }
  const relativePattern = pattern.replace(/^(?:\.\/)+/, "");
  return relativePattern.split("/");
}

function isTypeScriptSourcePath(path) {
  return path.endsWith(".ts") || path.endsWith(".tsx");
}

function comparePaths(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function shouldIgnoreMissingSymlinkTarget(error) {
  return SKIPPABLE_SYMLINK_ERRORS.has(error.code);
}

/**
 * Resolve positive include patterns against a CWD, following directory symlinks.
 * Results retain the first sorted matching path while deduplicating by real path.
 */
// @see [Tightscript: the resolver expands CWD-relative patterns to matching `.ts` and `.tsx` files.](./source-scope.md#tightscript-req-006)
// @see [Tightscript: the resolver inspects every source file matched from the invocation directory.](./source-scope.md#tightscript-prop-req-006-01)
// @see [Tightscript: the resolver applies generated patterns to all matching TypeScript paths.](./configuration.md#tightscript-prop-req-037-01)
// @see [react-next-compatibility: the source resolver restricts policy roots to selected `.ts` and `.tsx` files.](./framework-compatibility.md#react-next-compatibility-req-001)
// @see [react-next-compatibility: the resolver uses positive include patterns as its only source selector.](./framework-compatibility.md#react-next-compatibility-req-002)
// @see [react-next-compatibility: the source-scope resolver does not add unselected paths to policy roots.](./framework-compatibility.md#react-next-compatibility-prop-req-001-01)
// @see [next-routing-config-resolution: source resolution supplies only include-selected TypeScript roots to framework analysis.](./framework-compatibility.md#react-next-compatibility-req-002)
// @see [next-routing-config-resolution: the source resolver leaves convention and excluded paths outside policy roots.](./framework-compatibility.md#react-next-compatibility-prop-req-001-01)
// @see [nextjs-client-directive-exemption: The resolver selects only files matched by configured include patterns.](./repeated-strings.md#nextjs-client-directive-exemption-req-005)
export async function resolveSourceFiles(includePatterns, cwd = process.cwd()) {
  if (!Array.isArray(includePatterns) || includePatterns.length === 0) {
    throw new TypeError("Source-scope patterns must be a non-empty array.");
  }

  const patterns = includePatterns.map(compilePattern);
  const currentDirectory = resolve(cwd);
  const candidates = [];

  async function addFile(filePath) {
    const displayPath = relative(currentDirectory, filePath).split(sep).join("/");
    if (
      !isTypeScriptSourcePath(displayPath) ||
      !patterns.some((pattern) => patternMatchesPath(pattern, displayPath.split("/")))
    ) {
      return;
    }

    candidates.push({
      filePath,
      realPath: await realpath(filePath),
      displayPath,
    });
  }

  async function visitDirectory(directoryPath, activeDirectoryTargets) {
    const directoryTarget = await realpath(directoryPath);
    if (activeDirectoryTargets.has(directoryTarget)) {
      return;
    }

    activeDirectoryTargets.add(directoryTarget);
    try {
      const entries = await readdir(directoryPath, { withFileTypes: true });
      entries.sort((left, right) => comparePaths(left.name, right.name));

      for (const entry of entries) {
        const entryPath = resolve(directoryPath, entry.name);
        if (entry.isSymbolicLink()) {
          let targetStats;
          try {
            targetStats = await stat(entryPath);
          } catch (error) {
            if (shouldIgnoreMissingSymlinkTarget(error)) {
              continue;
            }
            throw error;
          }

          if (targetStats.isDirectory()) {
            await visitDirectory(entryPath, activeDirectoryTargets);
          } else if (targetStats.isFile()) {
            await addFile(entryPath);
          }
        } else if (entry.isDirectory()) {
          await visitDirectory(entryPath, activeDirectoryTargets);
        } else if (entry.isFile()) {
          await addFile(entryPath);
        }
      }
    } finally {
      activeDirectoryTargets.delete(directoryTarget);
    }
  }

  await lstat(currentDirectory);
  await visitDirectory(currentDirectory, new Set());

  candidates.sort((left, right) => comparePaths(left.displayPath, right.displayPath));
  const selected = [];
  const selectedRealPaths = new Set();
  for (const candidate of candidates) {
    if (selectedRealPaths.has(candidate.realPath)) {
      continue;
    }
    selectedRealPaths.add(candidate.realPath);
    selected.push(candidate);
  }

  return selected;
}
