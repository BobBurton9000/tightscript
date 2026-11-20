# 2026-11-20 — Next.js client directive exemption TASK-003

- Type: Test coverage
- Scope: Next.js client directive eligibility; TASK-003 in `.specflow/specs/nextjs-client-directive-exemption/`; changed paths: `test/cli-repeated-string.test.js`, `test/cli-config-property.test.js`, and `.specflow/specs/nextjs-client-directive-exemption/tasks.md`.
- Context and evidence: Approved property `PROP-REQ-001-01` requires only qualifying directive-prologue literals in supported Next.js context to be exempt, while non-qualifying forms and absent, unsupported, or indeterminate context remain subject to the existing repeated-string policy. The approved strategy also requires rejection of user-configurable exceptions.
- Decision or change: Added threshold-backed CLI coverage for post-prologue string expressions, parenthesized expressions, templates, and ordinary values; added absent, unsupported, and indeterminate Next.js context cases; and verified that a `directiveExceptions` setting is rejected. Linked the existing positive-context test title to `PROP-REQ-001-01` and marked TASK-003 complete after focused verification.
- Observed result: `node --test test/cli-repeated-string.test.js test/cli-config-property.test.js` passed (19 tests, 0 failures). `git diff --check` passed.
