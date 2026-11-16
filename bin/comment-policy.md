# Tightscript Comment and Link Policy

For maintainers changing TypeScript comment validation, this page records the approved comment, link-target, heading, and suppression contracts.

## Approved requirements

### TIGHTSCRIPT-REQ-010

- **Title:** Comments contain only one `@see` Markdown link

WHEN THE SYSTEM encounters a comment in a checked source file, THE SYSTEM SHALL accept it only if, after comment delimiters and formatting markers are ignored, its content consists solely of one `@see` and one Markdown link, with no additional prose. Any TypeScript comment form MAY be used.

### TIGHTSCRIPT-REQ-011

- **Title:** `@see` links resolve to tracked repository Markdown

WHEN a checked source file contains a valid `@see` comment, THE SYSTEM SHALL resolve the link path relative to the source file, follow symlinks to the final target, and accept the link only when that target is inside the repository, is a Markdown file, and is tracked by Git.

### TIGHTSCRIPT-REQ-012

- **Title:** Invalid `@see` targets are violations

IF an `@see` link points outside the repository, to a missing file, to a non-Markdown file, or to a Markdown file not tracked by Git, THEN THE SYSTEM SHALL report a violation.

### TIGHTSCRIPT-REQ-013

- **Title:** `@see` heading fragments resolve to generated anchors

IF an `@see` link contains a heading fragment that does not resolve to a heading in the target Markdown file using GitHub-compatible automatically generated heading anchors, including duplicate-heading suffixes, THEN THE SYSTEM SHALL report a violation.

### TIGHTSCRIPT-REQ-014

- **Title:** Suppression directives cannot suppress violations

IF source code contains a suppression directive, THEN THE SYSTEM SHALL report the comment-policy violation and MUST NOT let the directive suppress any other violation.

## Correctness properties

### TIGHTSCRIPT-PROP-REQ-010-01

- **Sources:** `REQ-010`, `REQ-011`, `REQ-012`, `REQ-013`, `REQ-014`
- **Living requirements:** [Tightscript: comments contain only one `@see` Markdown link](./comment-policy.md#tightscript-req-010); [Tightscript: `@see` links resolve to tracked repository Markdown](./comment-policy.md#tightscript-req-011); [Tightscript: invalid `@see` targets are violations](./comment-policy.md#tightscript-req-012); [Tightscript: `@see` heading fragments resolve to generated anchors](./comment-policy.md#tightscript-req-013); [Tightscript: suppression directives cannot suppress violations](./comment-policy.md#tightscript-req-014)
- **Title:** Comments cannot bypass comment or link policy
- **Preconditions:** The checked source contains comments. Link-target cases run in a Git repository so tracked-file status can be verified.
- **Input or state space:** Comment forms and formatting; valid and invalid Markdown links; paths resolved relative to the containing source file; target existence, type, and Git tracking after symlink resolution; heading fragments; suppression directives.
- **Invariant:** After comment delimiters and formatting markers are ignored, a comment is accepted only when its content consists solely of one `@see` and one Markdown link. The link path is resolved relative to the source file, symlinks are followed to the final target, and that target must be an existing tracked Markdown file inside the repository. A heading fragment, when present, must resolve using GitHub-compatible automatically generated heading anchors, including duplicate-heading suffixes. A suppression directive produces a comment-policy violation and does not suppress any other violation.
- **Boundaries:** Include extra prose, paths whose resolution distinguishes source-file-relative from CWD-relative behavior, missing targets, non-Markdown and untracked final targets, outside-repository final targets, valid and invalid GitHub-compatible heading fragments including duplicate-heading suffixes, and a suppression directive alongside a separate violation. Exercise symlink targets in an environment that permits symlink creation; if no such environment is available, report symlink coverage as a verification gap.
- **Test evidence:** `test/cli-comments-property.test.js` — `PROP-REQ-010-01` cases cover comment forms, prose and multiple links, invalid targets, heading fragments, suppression beside a separate violation, and symlink final-target behavior.
