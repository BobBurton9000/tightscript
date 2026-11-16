# Tightscript Imported Values

For maintainers changing imported-value analysis, this page records the approved pass-through contract and its tested invariant.

## Approved requirements

### TIGHTSCRIPT-REQ-019

- **Title:** Imported values are not passed through unchanged

WHEN a value is imported only to be re-exported unchanged, or is used only in recursively nested object or spread wrappers that are themselves exported without added behavior and are composed solely of imported values, THE SYSTEM SHALL report a violation. A local alias that directly binds to an imported value or qualifying wrapper remains a passthrough; object property names MAY differ from imported names. Each object property value and spread operand in a qualifying wrapper MUST be an imported value or a qualifying nested wrapper. A wrapper MUST NOT contain locally computed values, calls, methods, or accessors. This requirement does not prohibit source re-exports that do not meet that passthrough condition.

## Correctness properties

### TIGHTSCRIPT-PROP-REQ-019-01

- **Sources:** `REQ-019`
- **Living requirements:** [Tightscript: imported values are not passed through unchanged](./imported-values.md#tightscript-req-019)
- **Title:** Imported values cannot pass through exported wrappers
- **Preconditions:** The checked module graph resolves sufficiently to determine imported-value usage and exports.
- **Input or state space:** Imported values, their use sites, local aliases, export forms, and recursively nested object or spread wrappers.
- **Invariant:** The check reports an imported value used only for unchanged export, including through a local alias, or used only in recursively nested object or spread wrappers that are exported without added behavior and contain only imported values or qualifying nested wrappers. A source-module re-export that does not meet this passthrough condition is not prohibited by this property.
- **Boundaries:** Exercise direct pass-through, local aliases, nested wrappers, differing object property names, and spread operands. Confirm that locally computed values, calls, methods, accessors, imports used beyond the export chain, and source re-exports outside the qualifying condition do not produce a passthrough violation.
- **Test evidence:** `test/cli-imported-value-property.test.js` — `PROP-REQ-019-01` cases cover direct and aliased imports, nested wrappers, spreads, added behavior, extra uses, exempt re-exports, and unresolved symbols.
