# 2026-11-18 — Compatibility analyser test dependency

- Type: Test infrastructure maintenance
- Scope: Local TypeScript test dependency and npm installation metadata.
- Context and evidence: `typescript` was declared as a peer dependency but was not installed in the checkout, so importing the compatibility analyser stopped `node --test test/compatibility-analyser.test.js` during module loading with `ERR_MODULE_NOT_FOUND`. The package had no dev dependency or lockfile for installing the test dependency.
- Decision or change: Added TypeScript 5.9.3 as a development dependency while retaining the existing peer dependency range, generated `package-lock.json`, and ignored `node_modules/` so installed packages are not added to version control.
- Observed result: `npm ci` completed successfully. `node --test test/compatibility-analyser.test.js` passed all 11 tests, and `npm test` passed all 195 tests.
- Related entries: [Compatibility analyser foundation](2026-11-18-16-51-07-tightscript-task-003-compatibility-analyser.md).
