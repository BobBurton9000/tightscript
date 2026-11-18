# 2026-11-18 — Verify Next.js compatibility table through the CLI

- Type: Test coverage
- Scope: React and Next.js compatibility CLI tests (TASK-007)
- Context and evidence: The approved Feature requires the closed Next.js 16.x router, file-role, and export-name table to fail closed for unsupported or unresolved cases. TASK-007 called for real-CLI property coverage of that table, nested routes, root-versus-`src/` precedence, and routing configuration states.
- Decision or change: Added `test/cli-next-compatibility-property.test.js` with controlled temporary-project fixtures. It exercises all listed callable export combinations, App and Pages Router proxy contexts, supported `src/` layouts and root precedence, API and special-module boundaries, unsupported roles/names/majors, unresolved package version metadata, default/unchanged/changed/indeterminate routing configuration, checker-callable values without slot-signature validation, and non-execution of dynamic Next.js configuration.
- Observed result: `node --test test/cli-next-compatibility-property.test.js` passed (17 tests, 0 failures) after correcting an initial negative assertion whose pattern also matched the `src/` path. `npm test` passed (229 tests, 0 failures). The dynamic configuration test confirmed that its side effect did not occur.
