# 2026-11-15 — Tightscript interface policy

- Type: Implementation
- Scope: Interface policy enforcement for REQ-024 and REQ-026.
- Context and evidence: S5 selected TASK-011 after TASK-005 and TASK-007 were complete. The approved requirements prohibit interface data properties, index signatures, call and construct signatures (including inherited signatures), and explicit `CallableFunction` heritage; unresolved required heritage must fail evaluation.
- Decision or change: Added interface analysis in `bin/interface-validator.js`, wired it into `bin/tightscript.js`, and added real-CLI coverage in `test/cli-interface.test.js` for property and index rejection, direct and transitive call/construct signatures, method-only controls, `CallableFunction`, and unresolved heritage. Marked TASK-011 complete in `.specflow/specs/tightscript/tasks.md`.
- Observed result: `node --check bin/interface-validator.js`, `node --check test/cli-interface.test.js`, `node --check bin/tightscript.js`, and `git diff --check` passed. `npm test` passed all 51 tests on Node.js v26.13.1 with TypeScript 6.0.3. A temporary symlink to an already-installed TypeScript package was used because this checkout had no local TypeScript install; the symlink was removed after verification, and no dependency metadata was changed.
