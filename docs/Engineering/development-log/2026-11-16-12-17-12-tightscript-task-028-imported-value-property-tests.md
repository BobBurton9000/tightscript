# 2026-11-16 — Verify imported-value passthrough policy

- Type: Test coverage
- Scope: TASK-028; REQ-019 imported-value passthrough analysis
- Context and evidence: The approved PROP-REQ-019-01 invariant requires real TypeScript module graphs to distinguish imported values passed through directly or via nested wrappers from added behavior, extra uses, and exempt source re-exports.
- Decision or change: Added bounded real-CLI property cases in `test/cli-imported-value-property.test.js` for direct imports, local aliases, nested wrappers, renamed properties, spreads, added behavior, extra import uses, type-only and namespace re-exports, and unresolved symbols. Updated `.specflow/specs/tightscript/tasks.md` for TASK-028. Files changed: `test/cli-imported-value-property.test.js` and `.specflow/specs/tightscript/tasks.md`.
- Observed result: The focused property test run passed all 5 tests, and `npm test` passed all 135 tests on Node.js v26.13.1 with TypeScript 5.9.3. The repository had no `node_modules`; verification used the existing cached TypeScript package through a temporary Node.js module-resolution hook, without installing dependencies or changing project dependency files.
