# 2026-11-19 — Tightscript TASK-004 framework policy independence tests

- Type: Property verification
- Scope: Next.js convention and independent validator behaviour for `TASK-004` (`REQ-008`, `PROP-REQ-008-01`); changed files: `test/cli-framework-policy-independence-property.test.js` and `.specflow/specs/next-routing-config-resolution/tasks.md`.
- Context and evidence: The approved task requires real-CLI evidence that an eligible Next.js file-convention export does not suppress unrelated Tightscript policy findings.
- Decision or change: Added a bounded CLI regression case tagged `[PROP-REQ-008-01]` that combines an eligible App Router default export with imported-value passthrough, a non-convention callable export, type alias and union syntax, and an `else` branch. Marked `TASK-004` complete after focused verification passed.
- Observed result: `node --test test/cli-framework-policy-independence-property.test.js` passed (3 tests, 0 failures). `git diff --check` passed.
