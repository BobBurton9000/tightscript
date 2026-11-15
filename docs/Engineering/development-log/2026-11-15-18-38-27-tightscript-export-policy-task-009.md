# 2026-11-15 — Tightscript export policy rules (TASK-009)

- Type: Implementation
- Scope: Tightscript export-policy validation and real-CLI tests
- Context and evidence: Approved TASK-009 requires enforcement of REQ-020 and REQ-021. Its dependencies TASK-005 and TASK-007 were complete before implementation.
- Decision or change: Added export-list validation for locally declared values, leaving type-only exports and source-module re-exports exempt, and added checks for exported const object literals, class instances, and `Object.freeze` object literals across named and default export forms. Wired the validator into CLI diagnostics and added real-CLI tests with positive controls. Changed files: `bin/export-validator.js`, `bin/tightscript.js`, and `test/cli-export.test.js`.
- Observed result: `node --check` passed for the implementation, CLI, and new test file; `git diff --check` passed. `npm test` passed all 42 tests on Node.js 26.13.1 with TypeScript 5.9.3 and with TypeScript 6.0.3. The existing local TypeScript installations were exposed through temporary symlinks for each run; no dependency was installed and no temporary link remains.
