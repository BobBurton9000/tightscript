# 2026-11-20 — Next.js client directive exemption TASK-002

- Type: Test coverage
- Scope: Repeated-string CLI integration coverage; TASK-002 in `.specflow/specs/nextjs-client-directive-exemption/`; changed paths: `test/cli-repeated-string.test.js` and `.specflow/specs/nextjs-client-directive-exemption/tasks.md`.
- Context and evidence: Approved Feature requirements REQ-001 and REQ-002 require qualifying directives in selected `.ts` and `.tsx` files to be exempt in supported Next.js context without route classification or reliance on default routing configuration.
- Decision or change: Added CLI subcases for default, changed, and indeterminate routing configuration. Each project contains three qualifying directive literals across selected non-route `.ts` and `.tsx` files, including comments, a preceding directive, and both quote styles. The fixtures use valid tracked `@see` comments so unrelated REQ-010 comment validation remains satisfied. Marked TASK-002 complete after verification.
- Observed result: The initial focused test run exposed invalid prose comments in the test fixtures (REQ-010); the fixtures were corrected to valid tracked `@see` comments. `node --test test/cli-repeated-string.test.js` then passed (7 tests, 0 failures). `git diff --check` passed.
