# 2026-11-18 — TASK-001 framework context resolver

- Type: Feature implementation
- Scope: TASK-001; `bin/framework-context.js`, `test/framework-context.test.js`, and `.specflow/specs/react-next-compatibility/tasks.md`
- Context and evidence: The approved React and Next.js compatibility task requires invocation-directory Next.js package/version resolution without loading the package, plus static routing-configuration classification including `pageExtensions`.
- Decision or change: Added framework-context resolution with absent, supported, unsupported, and indeterminate Next.js outcomes. Added non-executing static inspection of Next.js configuration and temporary-project tests for version resolution, unreadable metadata, default/unchanged/changed/dynamic `pageExtensions`, and non-execution of package and configuration code.
- Observed result: `node --test test/framework-context.test.js` passed all 8 tests. `npm test` passed all 151 tests with 0 failures. The repository had no local TypeScript installation, so the existing global TypeScript 6.0.3 package was exposed temporarily through a local symlink for both commands; the symlink was removed afterward.
