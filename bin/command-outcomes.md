# Tightscript Command Outcomes

For maintainers changing CLI result handling, this page records approved pass/fail outcomes and their tested invariant.

## Approved requirements

### TIGHTSCRIPT-REQ-001

- **Title:** One command reports a pass-or-fail result

WHEN a user invokes Tightscript for a project, THE SYSTEM SHALL run the check through one user-facing command and produce a pass-or-fail result. The command SHALL exit with status 0 when it reports pass and with a nonzero status when the check fails, including for policy violations, evaluation errors, and source-scope configuration errors.

### TIGHTSCRIPT-REQ-002

- **Title:** A complete clean check passes, including an empty selection

WHEN every selected source file satisfies every applicable policy and the check completes without an evaluation error, including when no source files are selected, THE SYSTEM SHALL report a pass result.

### TIGHTSCRIPT-REQ-003

- **Title:** A policy violation fails the check

WHEN any selected source file violates an applicable policy, THE SYSTEM SHALL report a fail result.

### TIGHTSCRIPT-REQ-005

- **Title:** Incomplete evaluation fails closed

IF THE SYSTEM cannot evaluate a selected file or applicable policy, THEN THE SYSTEM SHALL fail the check and report the evaluation error; it MUST NOT report a pass for an incomplete check.

## Correctness properties

### TIGHTSCRIPT-PROP-REQ-001-01

- **Sources:** `REQ-001`, `REQ-002`, `REQ-003`, `REQ-005`, `REQ-039`
- **Living requirements:** [Tightscript: one command reports pass or fail](./command-outcomes.md#tightscript-req-001); [Tightscript: a complete clean check passes, including an empty selection](./command-outcomes.md#tightscript-req-002); [Tightscript: a policy violation fails the check](./command-outcomes.md#tightscript-req-003); [Tightscript: incomplete evaluation fails closed](./command-outcomes.md#tightscript-req-005); [Tightscript: a non-empty Tightscript source scope is required](./configuration.md#tightscript-req-039)
- **Title:** PASS requires a complete, clean check
- **Preconditions:** The CLI is invoked. Success cases use a present configuration with a non-empty include setting.
- **Input or state space:** A clean selection, a valid selection matching no files, a policy violation, an evaluation error, and missing configuration or an absent/empty source-scope setting.
- **Invariant:** The check reports PASS and exits with status 0 only when evaluation completes without violations. A valid empty selection passes. A policy violation produces FAIL and a nonzero exit status. An evaluation error or source-scope configuration error is reported and produces FAIL and a nonzero exit status.
- **Boundaries:** A non-empty include setting that matches no files is valid and passes; missing configuration or an absent/empty include setting fails. Policy violations and incomplete evaluation both fail.
- **Test evidence:** `test/cli-pass-fail-property.test.js` — stable test identifier `PROP-REQ-001-01` in cases covering clean and empty PASS, violation FAIL, configuration errors, selected-file parse errors, malformed compiler configuration, unresolved required heritage, and unrelated TypeScript errors.
