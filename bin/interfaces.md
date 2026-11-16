# Tightscript Interface Policy

For maintainers changing interface analysis, this page records the approved interface restrictions and inherited-signature invariant.

## Approved requirements

### TIGHTSCRIPT-REQ-024

- **Title:** Interfaces declare methods only and cannot inherit call or construct signatures

WHEN an interface declares a data property or index signature, or declares or inherits a call or construct signature, THE SYSTEM SHALL report a violation. A property whose type is a function remains a property for this requirement; only method declarations are allowed. Call and construct signatures inherited directly or transitively through extended interfaces are prohibited.

### TIGHTSCRIPT-REQ-026

- **Title:** Interfaces do not extend `CallableFunction`

WHEN an interface extends `CallableFunction`, THE SYSTEM SHALL report a violation.

## Correctness properties

### TIGHTSCRIPT-PROP-REQ-024-01

- **Sources:** `REQ-024`, `REQ-026`
- **Living requirements:** [Tightscript: interfaces declare methods only and cannot inherit call or construct signatures](./interfaces.md#tightscript-req-024); [Tightscript: interfaces do not extend `CallableFunction`](./interfaces.md#tightscript-req-026)
- **Title:** Interfaces cannot acquire prohibited signatures through inheritance
- **Preconditions:** The checked interface declarations and their heritage resolve sufficiently for semantic analysis.
- **Input or state space:** Interfaces with declared data properties or index signatures; direct and inherited call or construct signatures; multi-level and branched interface heritage; `CallableFunction`; method-only interfaces; and function-valued properties.
- **Invariant:** The check reports an interface that declares a data property or index signature, or declares or inherits a call or construct signature directly or transitively. A function-valued property is a data property, while a method declaration alone is permitted by this rule. The check also reports an interface that extends `CallableFunction`.
- **Boundaries:** Exercise direct and multi-level inherited call and construct signatures, branched heritage, method-only interfaces as controls, function-valued properties, index signatures, and explicit `CallableFunction` extension.
- **Test evidence:** `test/cli-interface-property.test.js` — `PROP-REQ-024-01` cases cover data/index/function-valued properties, branched inherited signatures, `CallableFunction`, method-only controls, and unresolved heritage.
