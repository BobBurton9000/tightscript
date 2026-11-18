# 2026-11-18 — Tightscript TASK-010 source-scope property tests

- Type: Test coverage
- Scope: React and Next.js compatibility source selection
- Context and evidence: TASK-010 in `.specflow/specs/react-next-compatibility/tasks.md` requires real-CLI evidence that compatibility analysis preserves the configured authored TypeScript source boundary and existing `init` defaults. The approved `PROP-REQ-001-01` defines the source-scope invariant.
- Decision or change: Added real-CLI source-scope property cases for React JSX analysis and its in-memory probe, Next.js convention modules, out-of-pattern/generated/dependency paths, JavaScript and JSX files, and unchanged `init` defaults. Marked TASK-010 complete after verification. Changed `test/cli-source-scope-property.test.js` and the selected checkbox in `.specflow/specs/react-next-compatibility/tasks.md`.
- Observed result: `node --test test/cli-source-scope-property.test.js test/cli-init-source-scope-property.test.js` passed all 7 tests with 0 failures, 0 skipped, and 0 cancelled. The complete `npm test` suite was not run; it remains outside TASK-010's focused verification scope.
