# 2026-11-15 — Tightscript private instance state

- Type: Implementation
- Scope: CLI private instance-state policy for REQ-022 and REQ-023.
- Context and evidence: S5 selected TASK-010 after its TASK-005 and TASK-007 dependencies were complete. The approved requirements cover instance properties, accessors, abstract properties, constructor parameter properties, and the precise DTO exception.
- Decision or change: Added class-state analysis in `bin/private-state-validator.js`, wired it into `bin/tightscript.js`, and added real-CLI coverage in `test/cli-private-state.test.js` for private and public members, static exclusions, DTO qualification, and method-disqualification boundaries.
- Observed result: `node --check bin/private-state-validator.js`, `node --check test/cli-private-state.test.js`, and `node --check bin/tightscript.js` passed. `node --test test/cli-private-state.test.js` passed all 4 tests, and `npm test` passed all 46 tests using TypeScript 5.9.3. The TypeScript dependency was resolved through a temporary symlink to an already-installed package during testing; the symlink was removed afterward.
