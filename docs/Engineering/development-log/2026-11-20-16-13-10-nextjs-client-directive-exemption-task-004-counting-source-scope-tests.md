# 2026-11-20 — Next.js client directive exemption TASK-004

- Type: Test coverage
- Scope: Repeated-string counting and source-selection boundaries; TASK-004 in `.specflow/specs/nextjs-client-directive-exemption/`; changed paths: `test/cli-repeated-string.test.js` and `.specflow/specs/nextjs-client-directive-exemption/tasks.md`.
- Context and evidence: Approved `PROP-REQ-004-01` requires supported-context directive exemptions to preserve the existing global occurrence threshold, Unicode code-point minimum, cross-file counting, `[REQ-035]` / `[REQ-036]` exclusions, and configured source set.
- Decision or change: Added supported Next.js CLI coverage combining qualifying directives with two-versus-three occurrence and Unicode boundaries, cross-file aggregation, existing literal exclusions, and out-of-pattern and out-of-extension source controls. Marked TASK-004 complete after focused verification.
- Observed result: `node --test test/cli-repeated-string.test.js` passed (13 tests, 0 failures). `git diff --check` passed.
