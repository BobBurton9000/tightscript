# 2026-11-16 — Count static re-export specifiers as repeated strings

- Type: Correctness fix
- Scope: REQ-034/REQ-035 repeated-string analysis and property verification.
- Context and evidence: The approved exclusion covers module specifiers in static imports and dynamic imports. The repeated-string analyzer also excluded `ExportDeclaration` module specifiers, while the existing property tests covered import declarations but not re-exports.
- Decision or change: Restricted the static module-specifier exclusion to `ImportDeclaration`. Added a real-CLI property case with three type-only re-exports of the same module specifier and assertions that each occurrence produces a REQ-034 diagnostic. Kept the existing static- and dynamic-import exclusion coverage.
- Observed result: On Node.js v26.13.1 with TypeScript 5.9.3 temporarily installed offline from the local npm cache, `node --test test/cli-repeated-string.test.js` passed all 3 tests and `npm test` passed all 143 tests with zero failures, skips, or cancellations. `node --check bin/repeated-string-validator.js`, `node --check test/cli-repeated-string.test.js`, and `git diff --check` passed. The temporary `node_modules` directory was removed; dependency metadata was unchanged.
