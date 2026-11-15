# 2026-11-15 — Tightscript type-alias and union validation (TASK-013)

- Type: Feature implementation
- Scope: Tightscript TypeScript syntax policy
- Context and evidence: S5 selected TASK-013 after its TASK-005 and TASK-007 dependencies were complete. Approved requirements REQ-029 and REQ-030 prohibit type-alias declarations and union type syntax in every selected source file, regardless of context.
- Decision or change: Added `bin/type-alias-union-validator.js` and wired it into the CLI. Added real-CLI coverage in `test/cli-type-syntax.test.js` for every fixture type alias and union node across `.ts` and `.tsx` selected files, with an unselected-file control.
- Observed result: On Node.js v26.13.1 with TypeScript 5.9.3 temporarily installed from the local npm cache for verification, `node --test test/cli-type-syntax.test.js` passed 1 test and `npm test` passed all 54 tests. `node --check bin/type-alias-union-validator.js`, `node --check test/cli-type-syntax.test.js`, `node --check bin/tightscript.js`, and `git diff --check` also passed.
