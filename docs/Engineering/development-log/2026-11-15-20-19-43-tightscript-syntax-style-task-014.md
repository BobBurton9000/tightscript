# 2026-11-15 — Tightscript syntax-style validation (TASK-014)

- Type: Feature implementation
- Scope: Tightscript TypeScript syntax policy
- Context and evidence: S5 selected TASK-014 after TASK-005 and TASK-007 were complete. Approved REQ-031, REQ-032, and REQ-033 define lowercase `get`-prefix naming checks, prohibit `else` branches, and require multiline layout for function-like constructs with multiple parameters while excluding call expressions.
- Decision or change: Added `bin/syntax-style-validator.js` and wired its REQ-031, REQ-032, and REQ-033 diagnostics into `bin/tightscript.js`. Added real-CLI cases in `test/cli-syntax-style.test.js` for named functions, function-valued variables and properties, object and class methods, `else`/`else if`, supported function-like declarations, expressions, types and signatures, valid multiline layouts, and call-expression exclusion.
- Observed result: On Node.js v26.13.1 with TypeScript 6.0.3 temporarily installed from the local npm cache, `node --test test/cli-syntax-style.test.js` passed all 4 tests and `npm test` passed all 58 tests. `node --check bin/syntax-style-validator.js`, `node --check test/cli-syntax-style.test.js`, `node --check bin/tightscript.js`, and `git diff --check` also passed. The first focused run exposed an incorrect expected source line in the REQ-032 test; that expectation was corrected and the rerun passed.
