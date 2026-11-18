# Tightscript Syntax Style

For maintainers changing naming, branch, or parameter-layout checks, this page records the approved declaration-style constraints.

## Approved requirements

### TIGHTSCRIPT-REQ-031

- **Title:** Lowercase `get` names are prohibited outside exact framework exports

WHEN a function or method name in a checked declaration begins with the lowercase prefix `get`, THE SYSTEM SHALL report a violation, unless the declaration is one of the exact locally implemented Pages Router callable exports allowed by the [framework compatibility contract](./framework-compatibility.md#react-next-compatibility-req-009). This applies to function declarations, function-valued variables, object methods or properties, and class methods.

### TIGHTSCRIPT-REQ-032

- **Title:** `else` and `else if` branches are prohibited

WHEN a checked statement contains an `else` or `else if` branch, THE SYSTEM SHALL report a violation.

### TIGHTSCRIPT-REQ-033

- **Title:** Multi-parameter function-like declarations use multiline parameter layout

WHEN a TypeScript function-like declaration, expression, type, or signature has two or more parameters, THE SYSTEM SHALL require each parameter to occupy its own line and require the opening and closing parentheses to occupy lines separate from the parameters. This includes function and method declarations, constructors, function and arrow expressions, function types, and call and construct signatures; it excludes call expressions.
