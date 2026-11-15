# 2026-11-15 — Tightscript type-annotation policy (TASK-012)

- Type: Feature implementation
- Scope: Tightscript TypeScript annotation validation
- Context and evidence: S5 selected TASK-012 after its TASK-005 and TASK-007 dependencies were complete. The approved Feature requirements REQ-027 and REQ-028 require anonymous object type rejection in function parameter/return annotations and top-level intersection rejection in property and function-parameter annotations, while preserving intersections in other contexts.
- Decision or change: Added `bin/type-annotation-validator.js` and wired it into the CLI. Added real-CLI tests in `test/cli-type-annotation.test.js` covering function declarations, expressions, function types and signatures; property and parameter intersections; parenthesized intersections; and controls for nested, return, and local intersections.
- Observed result: On Node.js v26.13.1 with TypeScript 5.9.3 available from the workspace-level peer dependency installation, `node --test test/cli-type-annotation.test.js` passed 2 tests and `npm test` passed all 53 tests. `node --check bin/type-annotation-validator.js`, `node --check test/cli-type-annotation.test.js`, `node --check bin/tightscript.js`, and `git diff --check` also passed.
