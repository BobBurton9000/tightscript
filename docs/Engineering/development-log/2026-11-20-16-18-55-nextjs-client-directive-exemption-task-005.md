# 2026-11-20 — Next.js client directive exemption TASK-005

- Type: Test coverage
- Scope: Policy independence; TASK-005 in `.specflow/specs/nextjs-client-directive-exemption/`; changed paths: `test/cli-framework-policy-independence-property.test.js` and `.specflow/specs/nextjs-client-directive-exemption/tasks.md`.
- Context and evidence: Approved `PROP-REQ-007-01` requires an unrelated Tightscript policy finding to remain present when qualifying client directives are exempted from repeated-string reporting.
- Decision or change: Added a supported Next.js CLI case with three qualifying directives across selected `.ts` and `.tsx` files and an unrelated `[REQ-032]` violation. The test asserts no `[REQ-034]` finding is emitted and the unrelated finding remains. Marked TASK-005 complete after focused verification.
- Observed result: `node --test test/cli-framework-policy-independence-property.test.js` passed (4 tests, 0 failures). `git diff --check` passed. The `.specflow/` task update is ignored by Git and was not staged.
