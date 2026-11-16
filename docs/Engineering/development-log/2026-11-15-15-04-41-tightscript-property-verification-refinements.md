# 2026-11-15 — Tightscript property verification refinements

- Type: Specification verification planning
- Scope: `.specflow/specs/tightscript/properties.md`.
- Context and evidence: The repository has no application source or test infrastructure. The approved design calls for real CLI integration tests using temporary projects and Git. The user approved Node.js `node:test` and `node:assert/strict` on Node.js 20 or later as a test environment only, not as a product support floor. Review found that `PROP-REQ-006-01` did not explicitly verify every matched file and `PROP-REQ-010-01` did not require reporting a symlink-coverage gap when symlink creation is unavailable.
- Decision or change: Clarified `PROP-REQ-006-01` verification to assert diagnostics for multiple matching files with distinct violations and absence of a non-matching control. Clarified `PROP-REQ-010-01` to require symlink-capable verification or an explicit coverage-gap report. Kept the approved test runner and test environment details. Did not create properties for the identified `REQ-004` and `REQ-008` candidates.
- Expected effect: The verification descriptions should better expose incomplete source selection and symlink-validation coverage; this effect is not measured by tests.
- Observed result: Read back the changed property sections and confirmed the clarifications are present. No tests were run; the repository has no implementation or configured test harness.
- Follow-up: The user may separately start `specflow.s3.properties` to derive properties for `REQ-004` and `REQ-008` if warranted.
- Related entries: [Tightscript correctness properties](2026-11-15-12-43-11-tightscript-correctness-properties.md)
