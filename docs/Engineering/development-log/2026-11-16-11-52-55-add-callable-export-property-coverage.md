# 2026-11-16 — Add callable export property coverage

- Type: Test coverage
- Scope: REQ-018 callable-export CLI behavior
- Context and evidence: TASK-027 adds property-based CLI verification for `PROP-REQ-018-01`, whose approved invariant prohibits callable value exports while allowing type-only exports and requires fail-closed behavior when callability cannot be resolved.
- Decision or change: Added real-CLI cases for direct callable and non-callable exports, named and star callable re-exports, type-only exports, and unresolved callability. Updated `.specflow/specs/tightscript/tasks.md` to mark TASK-027 complete. Files changed: `test/cli-export-property.test.js` and `.specflow/specs/tightscript/tasks.md`.
- Observed result: `npm test` passed all 130 tests on Node.js v26.13.1 with TypeScript 5.9.3. TypeScript was temporarily linked from the existing local npm cache for verification; the temporary `node_modules` directory was removed afterwards.
