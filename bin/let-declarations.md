# Tightscript Let Declarations

For maintainers changing the let-declaration policy, this page records the approved prohibition and its diagnostic contract.

## Approved requirements

### TIGHTSCRIPT-REQ-009

- **Title:** `let` declarations are prohibited

WHEN a checked source file declares a variable with `let`, including a binding in a `for`, `for…of`, or `for…in` statement, THE SYSTEM SHALL report a violation.
