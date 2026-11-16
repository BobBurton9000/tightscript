# Tightscript Repeated Strings

For maintainers changing repeated-string analysis, this page records the approved global threshold, exclusions, and tested invariant.

## Approved requirements

### TIGHTSCRIPT-REQ-034

- **Title:** Repeated eligible string literals are extracted across the checked codebase

WHEN the same eligible string literal value of at least three characters occurs at least three times across the checked codebase, THE SYSTEM SHALL report every occurrence and require the occurrences to be replaced by one named constant reused wherever that value is needed. Occurrences are counted across all selected files, not separately per file. Single- and double-quoted string literals and template literals with no substitutions are eligible and SHALL be compared by their resulting string values; template literals containing substitutions are not eligible. The threshold and minimum length are fixed policy and MUST NOT be configurable.

### TIGHTSCRIPT-REQ-035

- **Title:** Specified string literal forms are excluded from repeated-string counts

THE SYSTEM SHALL exclude the following string literals from the REQ-034 count: module specifiers in static imports and dynamic imports; string arguments to `require()`; property and method keys; TypeScript literal types; and enum members.

### TIGHTSCRIPT-REQ-036

- **Title:** Direct `typeof` comparisons are excluded from repeated-string counts

THE SYSTEM SHALL exclude a string literal from the REQ-034 count when it is directly compared with a unary `typeof` expression using `===`, `!==`, `==`, or `!=`, in either operand order. No other string-literal whitelist is permitted.

## Correctness properties

### TIGHTSCRIPT-PROP-REQ-034-01

- **Sources:** `REQ-034`, `REQ-035`, `REQ-036`
- **Living requirements:** [Tightscript: repeated eligible string literals are extracted across the checked codebase](./repeated-strings.md#tightscript-req-034); [Tightscript: specified string literal forms are excluded from repeated-string counts](./repeated-strings.md#tightscript-req-035); [Tightscript: direct `typeof` comparisons are excluded from repeated-string counts](./repeated-strings.md#tightscript-req-036)
- **Title:** Repeated eligible strings are counted across the checked set
- **Preconditions:** The selected source files and applicable policies are evaluated completely.
- **Input or state space:** Eligible literal values across one or multiple selected files, literal forms, and the specified syntactic exclusions.
- **Invariant:** When the same eligible string value has at least three Unicode code points and occurs at least three times across the checked codebase, every eligible occurrence is reported. Occurrences excluded by `REQ-035` or `REQ-036` do not contribute to the count.
- **Boundaries:** Exercise two versus three occurrences, two versus three Unicode code points, occurrences split across files, single- and double-quoted literals, unsubstituted templates, and each specified exclusion. Include a two-code-point value made from supplementary-plane characters (four UTF-16 code units) to distinguish code-point counting from code-unit counting.
- **Test evidence:** `test/cli-repeated-string.test.js` — `PROP-REQ-034-01` cases cover cross-file occurrence and code-point thresholds, every REQ-035/REQ-036 exclusion, and static re-export module specifiers.
