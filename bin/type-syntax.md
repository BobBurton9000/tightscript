# Tightscript Type Syntax

For maintainers changing type-syntax validation, this page records the approved type-alias and union prohibitions.

## Approved requirements

### TIGHTSCRIPT-REQ-029

- **Title:** Type alias declarations are prohibited

WHEN a TypeScript type alias declaration appears in a checked source file, THE SYSTEM SHALL report a violation.

### TIGHTSCRIPT-REQ-030

- **Title:** Union type syntax is prohibited

WHEN union type syntax appears in a checked source file, THE SYSTEM SHALL report a violation, regardless of the context in which the union occurs.
