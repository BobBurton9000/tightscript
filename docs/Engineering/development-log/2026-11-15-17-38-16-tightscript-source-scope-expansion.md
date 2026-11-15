# 2026-11-15 — Tightscript source-scope expansion

- Type: Implementation
- Scope: Source-scope pattern expansion and filesystem traversal (`TASK-004`).
- Context and evidence: The approved task requires positive CWD-relative glob selection of `.ts` and `.tsx` files, including directory symlinks, with active-chain cycle detection and physical-file deduplication. Before this change, no source-scope resolver existed.
- Decision or change: Added `bin/source-scope.js` to expand `*`, `?`, and `**` patterns, traverse hidden and dependency directories and external symlink targets, stop directory cycles using active real paths, and retain the first sorted matching path while deduplicating by final real path. Added `test/source-scope.test.js` with real temporary filesystem cases for CWD-relative patterns, exact extensions, hidden/dependency directories, external targets, alias deduplication, cycles, and independence from `tsconfig.json` file lists.
- Observed result: `npm test` passed all 19 tests on Node.js `v26.13.1`; both symlink scenarios ran without skips. `node --check bin/source-scope.js`, `node --check test/source-scope.test.js`, and `git diff --check` also passed.
- Follow-up: User-visible diagnostic-path assertions remain deferred to the separately approved `TASK-024` as specified by `TASK-004`.
