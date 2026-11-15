# 2026-11-15 — Tightscript file-structure rules (TASK-008)

- Type: Implementation
- Scope: Tightscript file-structure policy validation and real-CLI tests
- Context and evidence: Approved task TASK-008 requires CLI enforcement of REQ-015 exported class/interface basename matching, REQ-016's 600-effective-line limit with import-only-line handling, and REQ-017's per-file class/interface declaration total. Its dependencies TASK-005 and TASK-007 were complete before implementation.
- Decision or change: Added file-structure validation for exported class and interface declarations (including local export lists and the `index` exception), effective line counting that excludes only import-only lines, and per-file counting of class declarations, class expressions, and interfaces. Wired the validator into CLI diagnostics and added real-CLI boundary and control tests. Changed files: `bin/file-structure-validator.js`, `bin/tightscript.js`, and `test/cli-file-structure.test.js`.
- Observed result: `node --check` passed for all three changed JavaScript implementation/test files, and `git diff --check` passed. `npm test` passed all 40 tests on Node.js 26.13.1 with TypeScript 5.9.3 and again with TypeScript 6.0.3. Each TypeScript version was linked temporarily from an existing local installation; no dependency was installed and no temporary link remained.
