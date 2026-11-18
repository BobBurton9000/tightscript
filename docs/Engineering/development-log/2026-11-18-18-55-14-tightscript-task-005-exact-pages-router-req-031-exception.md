# 2026-11-18 — Exact Pages Router REQ-031 exception

- Type: Compatibility implementation and test
- Scope: Next.js Pages Router export-name validation.
- Context and evidence: TASK-005 required the REQ-031 exception to apply only to local declarations whose exact names match eligible Pages Router data-export slots; existing framework analysis already recorded eligible declaration identities, but the syntax-style validator did not consume them.
- Decision or change: Passed the compatibility result from the CLI into the syntax-style validator and suppressed REQ-031 only for declaration nodes in the analyser's eligible identity set. Added real-CLI coverage for the three exact local data exports, differently named local aliases, imported-value aliases, API and special modules, unsupported Next.js versions, and other lowercase `get` declarations. Files changed: `bin/tightscript.js`, `bin/syntax-style-validator.js`, and `test/cli-framework-compatibility.test.js`.
- Observed result: `node --test test/cli-framework-compatibility.test.js test/cli-syntax-style.test.js` passed all 12 tests. `npm test` passed all 203 tests.
