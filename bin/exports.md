# Tightscript Export Policy

For maintainers changing export validation, this page records the approved callable, local-export, and object-shaped export contracts.

## Approved requirements

### TIGHTSCRIPT-REQ-018

- **Title:** Modules do not export callable standalone values

WHEN a checked module exports a standalone function or callable value, directly or through a named re-export or `export *`, THE SYSTEM SHALL report a violation if the exported value is callable. Type-only exports MUST NOT be treated as callable-value exports.

### TIGHTSCRIPT-REQ-020

- **Title:** Local values are exported inline

WHEN a locally declared value is exported through a separate local export list instead of an inline export declaration, THE SYSTEM SHALL report a violation. Source-module re-exports are exempt from this requirement.

### TIGHTSCRIPT-REQ-021

- **Title:** Exported object-shaped constant values are prohibited

WHEN a module exports a `const` binding initialized with an object literal, a class instance, or `Object.freeze({ ... })`, whether through an inline named export or as the target of a default export, or directly default-exports one of those expressions, THE SYSTEM SHALL report a violation.

## Correctness properties

### TIGHTSCRIPT-PROP-REQ-018-01

- **Sources:** `REQ-018`
- **Living requirements:** [Tightscript: modules do not export callable standalone values](./exports.md#tightscript-req-018)
- **Title:** Callable value exports fail across module boundaries
- **Preconditions:** The checked module graph permits the TypeScript semantic analysis needed to determine whether exported values are callable.
- **Input or state space:** Direct exports of standalone functions or callable values, named re-exports, `export *`, and type-only exports.
- **Invariant:** A module fails the policy check when it exports a callable value directly or through a named re-export or `export *`. A type-only export is not treated as a callable-value export.
- **Boundaries:** Include callable and non-callable values, named re-exports, star re-exports, and type-only exports.
- **Test evidence:** `test/cli-export-property.test.js` — `PROP-REQ-018-01` cases cover direct callable and non-callable values, named and star re-exports, type-only exports, and unresolved callability information.
