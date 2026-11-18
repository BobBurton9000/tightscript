# 2026-11-18 — Next.js router-role table for TASK-002

- Type: Implementation
- Scope: React/Next.js framework-context classification and its tests
- Context and evidence: The first available task in `.specflow/specs/react-next-compatibility/tasks.md` was TASK-002, covering the approved Next.js 16.x router, file-role, and export-name table for REQ-005, REQ-006, and REQ-009.
- Decision or change: Added a closed Next.js 16.x classification table and a classifier for nested App Router and Pages Router modules, root-versus-`src/` routing precedence, project-level proxy modules, Pages API routes, and special Pages modules. Added temporary-project table cases for the listed roles and export names, supported layouts, and fail-closed unsupported contexts and paths. Changed files: `bin/framework-context.js`; `test/framework-context.test.js`.
- Observed result: `node --check bin/framework-context.js && node --check test/framework-context.test.js` passed, and `git diff --check` passed. `node --test test/framework-context.test.js` could not load the suite because the repository has no resolvable `typescript` package (`ERR_MODULE_NOT_FOUND`). Functional behavior is therefore unverified; no task-completion claim is made.
- Follow-up: Make the declared TypeScript peer dependency available in the test environment and rerun `node --test test/framework-context.test.js` before treating this work as verified.
