# 2026-11-18 — Tightscript TASK-006 React compatibility property tests

- Type: Test implementation
- Scope: React and Next.js framework compatibility CLI tests
- Context and evidence: Approved Feature task `TASK-006` requires real-CLI property coverage for `PROP-REQ-004-01`, including React JSX acceptance, local implementation provenance, and fail-closed semantic outcomes.
- Decision or change: Added `test/cli-framework-compatibility-property.test.js` with temporary-project CLI cases for configured `react` and `react-jsx` modes, valid and invalid component exports, missing and unresolved React declarations, direct/aliased/local-wrapper and reviewed React-wrapper implementations, imported callables and aliases, re-exports, unrelated callback/property occurrences, imported possible-final branches, unknown wrappers, and resolved Next.js context. Marked `TASK-006` complete in `.specflow/specs/react-next-compatibility/tasks.md` after verification.
- Observed result: `node --test test/cli-framework-compatibility-property.test.js test/cli-framework-compatibility.test.js test/compatibility-analyser.test.js` passed: 28 tests, 0 failures. The property cases observed PASS for eligible local implementations, REQ-018 for known-ineligible exports, and REQ-005 evaluation failures with REQ-018 retained when React semantics were incomplete.
