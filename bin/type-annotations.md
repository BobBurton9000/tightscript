# Tightscript Type Annotations

For maintainers changing annotation validation, this page records the approved function-contract and intersection restrictions.

## Approved requirements

### TIGHTSCRIPT-REQ-027

- **Title:** Function contracts use named object structures

WHEN a function parameter or return type annotation uses an anonymous object type literal, THE SYSTEM SHALL report a violation; the structure MUST use a named interface or class instead.

### TIGHTSCRIPT-REQ-028

- **Title:** Property and parameter annotations do not use intersections

WHEN a property type annotation or function parameter type annotation is an intersection type, THE SYSTEM SHALL report a violation. This requirement does not prohibit intersection types in other contexts.
