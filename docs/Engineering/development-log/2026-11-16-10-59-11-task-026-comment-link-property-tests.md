# 2026-11-16 — TASK-026 comment and link property tests

- Type: Test implementation
- Scope: Tightscript comment and `@see` link policy (`PROP-REQ-010-01`)
- Context and evidence: `TASK-026` was the first available task in `.specflow/specs/tightscript/tasks.md`. The approved property requires comments and links to obey the comment-format, repository-target, heading-fragment, and suppression rules in `REQ-010` through `REQ-014`.
- Decision or change: Added `test/cli-comments-property.test.js` with bounded real-CLI cases in temporary Git repositories for TypeScript comment forms, source-file-relative tracked Markdown links, invalid comment content and target classes, valid and invalid GitHub heading fragments including duplicate suffixes, suppression alongside a separate `REQ-009` violation, and symlink final-target checks. Marked only `TASK-026` complete.
- Observed result: With Node.js `v26.13.1` and TypeScript `5.9.3`, `node --test test/cli-comments-property.test.js` passed all 19 tests with no skips; `npm test` passed all 125 tests with no skips. Symlink creation was supported and all four final-target cases passed. TypeScript was installed temporarily from the local npm cache using `npm install --no-save --package-lock=false --ignore-scripts --offline --no-audit --no-fund typescript@5.9.3`; no package metadata was changed.
