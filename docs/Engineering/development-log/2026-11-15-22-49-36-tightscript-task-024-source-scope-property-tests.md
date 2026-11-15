# 2026-11-15 — TASK-024 source-scope property tests

- Type: Real-CLI property tests
- Scope: Invocation-CWD-relative source selection and stable diagnostics for deduplicated aliases.
- Context and evidence: TASK-024 and `PROP-REQ-006-01` require real-CLI evidence that each invocation's CWD anchors include patterns, matching `.ts` and `.tsx` files are inspected, non-matching files are excluded, and duplicate symlink aliases retain the first sorted diagnostic path.
- Decision or change: Added `test/cli-source-scope-property.test.js` with root and nested CWD cases, distinct violations and non-matching controls, plus a symlink-alias case tagged with `PROP-REQ-006-01`.
- Observed result: The direct test attempt initially could not load TypeScript because the project has no installed peer dependency. With the existing TypeScript 5.9.3 package temporarily linked for module resolution and removed after each run, Node.js v26.13.1 passed the targeted test (2/2, including symlink coverage) and `npm test` passed all 99 tests with no skips.
