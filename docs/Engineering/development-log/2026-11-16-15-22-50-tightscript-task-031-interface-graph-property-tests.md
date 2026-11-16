# 2026-11-16 — Tightscript TASK-031 interface graph property tests

- Type: Test coverage
- Scope: Interface-policy CLI integration verification
- Context and evidence: TASK-031 exercises approved property `PROP-REQ-024-01`, derived from `REQ-024` and `REQ-026`. Existing interface analysis and CLI tests were inspected before adding property-level coverage.
- Decision or change: Added `test/cli-interface-property.test.js` with bounded real-CLI cases for declared data, index, and function-valued properties; direct and transitive call/construct signatures through branched interface graphs; `CallableFunction`; method-only controls; and unresolved heritage. Updated the selected checkbox in `.specflow/specs/tightscript/tasks.md`. No implementation code changed.
- Observed result: On Node.js v26.13.1 with TypeScript 6.0.3 temporarily installed for verification, `node --test test/cli-interface.test.js test/cli-interface-property.test.js` passed all 10 tests and `npm test` passed all 142 tests. The temporary TypeScript installation was removed after verification.
