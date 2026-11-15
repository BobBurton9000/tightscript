# 2026-11-15 — Tightscript let-declaration validation

- Type: Implementation
- Scope: Tightscript policy validation and tests (TASK-006)
- Context and evidence: Approved requirement `REQ-009` prohibits `let` declarations in ordinary bindings and in `for`, `for…of`, and `for…in` bindings. The existing TypeScript analysis exposes selected source files for policy validation.
- Decision or change: Added `bin/let-declaration-validator.js` to find TypeScript `let` declaration lists and report the `let` keyword's file, line, column, and `REQ-009` identifier. Added `test/let-declaration-validator.test.js` covering ordinary multi-binding declarations, each loop form, and `var`/`const` controls.
- Observed result: `git diff --check`, `node --check bin/let-declaration-validator.js`, and `node --check test/let-declaration-validator.test.js` passed. `npm test` passed all 28 tests on Node.js 26.13.1 with TypeScript 5.9.3 and again with TypeScript 6.0.3. A temporary local symlink exposed each already-installed TypeScript version to the test runner and was removed afterward.
