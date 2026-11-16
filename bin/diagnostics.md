# Tightscript Diagnostics

For maintainers changing policy reporting, this page records the approved location and requirement-identification contract.

## Approved requirements

### TIGHTSCRIPT-REQ-004

- **Title:** Policy violations identify the file, location, and requirement

WHEN THE SYSTEM reports a policy violation, THE SYSTEM SHALL identify the affected file, source location, and requirement ID.

## Correctness properties

### TIGHTSCRIPT-PROP-REQ-004-01

- **Sources:** `REQ-004`
- **Living requirements:** [Tightscript: policy violations identify the file, location, and requirement](./diagnostics.md#tightscript-req-004)
- **Title:** Every policy diagnostic identifies its source and rule
- **Preconditions:** A selected source file produces one or more policy violations and the check reports those violations.
- **Input or state space:** Policy violations from different diagnostic producers, at different source locations and in one or multiple checked files.
- **Invariant:** Every reported policy-violation diagnostic identifies the affected file, the correct source location, and the requirement ID that was violated.
- **Boundaries:** Exercise multiple violations from different requirements in one file and violations across files; verify each diagnostic's file, line, column, and requirement ID.
- **Test evidence:** `test/cli-diagnostics-property.test.js` — `[PROP-REQ-004-01] every policy diagnostic identifies its file, location, and requirement`.
