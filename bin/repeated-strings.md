# Tightscript Repeated Strings

For maintainers changing repeated-string analysis, this page records the approved global threshold, exclusions, and tested invariant.

## Approved requirements

### TIGHTSCRIPT-REQ-034

- **Title:** Repeated eligible string literals are extracted across the checked codebase

WHEN the same eligible string literal value of at least three characters occurs at least three times across the checked codebase, excluding qualifying Next.js client-directive occurrences covered by [the client-directive exception](#nextjs-client-directive-exemption-req-001), THE SYSTEM SHALL report every counted occurrence and require the occurrences to be replaced by one named constant reused wherever that value is needed. Occurrences are counted across all selected files, not separately per file. Single- and double-quoted string literals and template literals with no substitutions are eligible and SHALL be compared by their resulting string values; template literals containing substitutions are not eligible. The threshold and minimum length are fixed policy and MUST NOT be configurable.

### TIGHTSCRIPT-REQ-035

- **Title:** Specified string literal forms are excluded from repeated-string counts

THE SYSTEM SHALL exclude the following string literals from the REQ-034 count: module specifiers in static imports and dynamic imports; string arguments to `require()`; property and method keys; TypeScript literal types; and enum members.

### TIGHTSCRIPT-REQ-036

- **Title:** Direct `typeof` comparisons are excluded from repeated-string counts

THE SYSTEM SHALL exclude a string literal from the REQ-034 count when it is directly compared with a unary `typeof` expression using `===`, `!==`, `==`, or `!=`, in either operand order. No other string-literal whitelist is permitted beyond the qualifying Next.js client directives defined by [the client-directive exception](#nextjs-client-directive-exemption-req-001).

## Next.js client directive exception

The module directive prologue is the contiguous sequence of bare, top-level string-literal expression statements beginning with the first statement and ending before the first non-directive statement. Comments and other trivia do not interrupt the prologue, and `use client` may follow another directive in the sequence.

### NEXTJS-CLIENT-DIRECTIVE-EXEMPTION-REQ-001

- **Title:** Exclude valid Next.js client directives from repeated-string counts

WHEN Tightscript evaluates a selected `.ts` or `.tsx` file in a project whose resolved Next.js version is supported, and a bare top-level single- or double-quoted string-literal expression whose resulting value is exactly `use client` occurs in the module directive prologue, THE SYSTEM SHALL exclude that occurrence from [Tightscript repeated-string counts](#tightscript-req-034).

### NEXTJS-CLIENT-DIRECTIVE-EXEMPTION-REQ-002

- **Title:** Do not require a route-module classification for the exception

WHEN a selected `.ts` or `.tsx` file satisfies [the qualifying client-directive condition](#nextjs-client-directive-exemption-req-001), THE SYSTEM SHALL apply the exception based on the resolved supported Next.js project context and directive position, without requiring the file to match a Next.js route-convention role or the project to have default routing configuration.

### NEXTJS-CLIENT-DIRECTIVE-EXEMPTION-REQ-003

- **Title:** Keep non-directive occurrences subject to the existing policy

WHEN the value `use client` occurs in a selected source file but does not satisfy [the qualifying client-directive condition](#nextjs-client-directive-exemption-req-001), including when it is an ordinary value, occurs after the directive prologue, or the project has absent, indeterminate, or unsupported Next.js context, THE SYSTEM SHALL evaluate the occurrence under the existing [Tightscript repeated-string eligibility and counting rules](#tightscript-req-034).

### NEXTJS-CLIENT-DIRECTIVE-EXEMPTION-REQ-004

- **Title:** Preserve repeated-string thresholds and unrelated exclusions

WHEN Tightscript evaluates repeated strings after applying [the client-directive exception](#nextjs-client-directive-exemption-req-001), THE SYSTEM SHALL retain the global occurrence threshold, minimum string length, and cross-file counting behavior in [Tightscript's repeated-string requirement](#tightscript-req-034), and SHALL continue to apply the exclusions in [Tightscript's specified literal exclusions](#tightscript-req-035) and [Tightscript's direct `typeof` comparison exclusion](#tightscript-req-036). No occurrence other than a qualifying `use client` directive SHALL be excluded by this specification.

### NEXTJS-CLIENT-DIRECTIVE-EXEMPTION-REQ-005

- **Title:** Preserve the configured source set

WHEN Tightscript evaluates this exception, THE SYSTEM SHALL use the existing configured source-selection rules and SHALL NOT add files to the selected source set.

### NEXTJS-CLIENT-DIRECTIVE-EXEMPTION-REQ-006

- **Title:** Keep the exception fixed and non-configurable

THE SYSTEM SHALL NOT provide a user-configurable per-file exception, rule switch, or suppression mechanism for this behavior.

### NEXTJS-CLIENT-DIRECTIVE-EXEMPTION-REQ-007

- **Title:** Preserve unrelated Tightscript policies

WHEN Tightscript applies this exception, THE SYSTEM SHALL continue to enforce all unrelated Tightscript policies independently.

## Correctness properties

### NEXTJS-CLIENT-DIRECTIVE-EXEMPTION-PROP-REQ-001-01

- **Sources:** `REQ-001`, `REQ-002`, `REQ-003`, `REQ-006`
- **Living requirements:** [nextjs-client-directive-exemption: exclude valid Next.js client directives from repeated-string counts](#nextjs-client-directive-exemption-req-001); [nextjs-client-directive-exemption: do not require a route-module classification for the exception](#nextjs-client-directive-exemption-req-002); [nextjs-client-directive-exemption: keep non-directive occurrences subject to the existing policy](#nextjs-client-directive-exemption-req-003); [nextjs-client-directive-exemption: keep the exception fixed and non-configurable](#nextjs-client-directive-exemption-req-006)
- **Title:** Exempt only qualifying Next.js client directives
- **Preconditions:** A selected `.ts` or `.tsx` file is evaluated. The exception applies only when the project has a resolved supported Next.js version.
- **Input or state space:** Resolved Next.js context; directive-prologue position; bare single- or double-quoted string literals whose resulting value is `use client`; and other occurrences of that value.
- **Invariant:** In a supported Next.js context, only a bare top-level `use client` string-literal expression in the module directive prologue is excluded from [Tightscript repeated-string counts](#tightscript-req-034). Route role and routing configuration do not affect eligibility. Every other otherwise-eligible occurrence remains subject to the existing counting rules. No user-configurable setting, rule switch, or suppression changes the exception.
- **Boundaries:** Comments and preceding directives do not end the prologue. An occurrence after the first non-directive statement, a parenthesized expression, a template literal, or an ordinary value is not exempt. Absent, unsupported, or indeterminate Next.js context grants no exemption.
- **Test evidence:** `test/cli-repeated-string.test.js` — `[PROP-REQ-001-01, REQ-001, REQ-002] supported Next.js context exempts selected non-route client directives regardless of routing configuration`; `[PROP-REQ-001-01] post-prologue strings, parenthesized literals, templates, and ordinary values remain countable`; `[PROP-REQ-001-01] absent Next.js context does not exempt qualifying directives`, `[PROP-REQ-001-01] unsupported Next.js context does not exempt qualifying directives`, and `[PROP-REQ-001-01] indeterminate Next.js context does not exempt qualifying directives`; `test/cli-config-property.test.js` — `[PROP-REQ-001-01] user-configurable client directive exceptions are rejected`; `test/cli-comments-property.test.js` — `[PROP-REQ-010-01] suppression comments fail without hiding separate policy violations`.

### NEXTJS-CLIENT-DIRECTIVE-EXEMPTION-PROP-REQ-004-01

- **Sources:** `REQ-004`, `REQ-005`
- **Living requirements:** [nextjs-client-directive-exemption: preserve repeated-string thresholds and unrelated exclusions](#nextjs-client-directive-exemption-req-004); [nextjs-client-directive-exemption: preserve the configured source set](#nextjs-client-directive-exemption-req-005)
- **Title:** Preserve repeated-string counting and source selection
- **Preconditions:** Tightscript evaluates the configured source set, with or without qualifying directive occurrences.
- **Input or state space:** Eligible string values across selected files; occurrence and Unicode-code-point thresholds; existing exclusions under Tightscript requirements 035 and 036; and files inside or outside the configured source set.
- **Invariant:** Excluding qualifying directive occurrences does not change the existing global occurrence threshold, minimum string length, cross-file counting, or the exclusions in Tightscript requirements 035 and 036. The existing source-selection rules remain authoritative; no additional files are selected, and no other occurrence is excluded by this feature.
- **Boundaries:** Exercise two versus three occurrences, two versus three Unicode code points, values split across files, the existing excluded literal forms, and selected versus unselected source paths and extensions.
- **Test evidence:** `test/cli-repeated-string.test.js` — `[PROP-REQ-004-01, REQ-004] all REQ-035 and REQ-036 exclusions remain excluded with supported Next.js directives`; `[PROP-REQ-004-01, REQ-004] supported context preserves repeated-string thresholds, Unicode boundaries, and cross-file counting`; `[PROP-REQ-004-01, REQ-005] configured source selection excludes out-of-scope paths and extensions`.

### NEXTJS-CLIENT-DIRECTIVE-EXEMPTION-PROP-REQ-007-01

- **Sources:** `REQ-001`, `REQ-007`
- **Living requirements:** [nextjs-client-directive-exemption: exclude valid Next.js client directives from repeated-string counts](#nextjs-client-directive-exemption-req-001); [nextjs-client-directive-exemption: preserve unrelated Tightscript policies](#nextjs-client-directive-exemption-req-007)
- **Title:** Keep unrelated Tightscript policies independent
- **Preconditions:** A selected source contains a qualifying directive in a supported Next.js context, and the same evaluation contains an unrelated policy violation.
- **Input or state space:** A CLI evaluation containing qualifying directive occurrences and a violation governed by an independent Tightscript policy.
- **Invariant:** Applying the directive exception does not suppress or alter unrelated Tightscript policy findings.
- **Boundaries:** The CLI continues to report an unrelated violation while not reporting qualifying directives as repeated-string occurrences.
- **Test evidence:** `test/cli-framework-policy-independence-property.test.js` — `[PROP-REQ-007-01, REQ-001, REQ-007] supported Next.js client directives leave unrelated policy findings enabled`.


### TIGHTSCRIPT-PROP-REQ-034-01

- **Sources:** `REQ-034`, `REQ-035`, `REQ-036`
- **Living requirements:** [Tightscript: repeated eligible string literals are extracted across the checked codebase](./repeated-strings.md#tightscript-req-034); [Tightscript: specified string literal forms are excluded from repeated-string counts](./repeated-strings.md#tightscript-req-035); [Tightscript: direct `typeof` comparisons are excluded from repeated-string counts](./repeated-strings.md#tightscript-req-036)
- **Title:** Repeated eligible strings are counted across the checked set
- **Preconditions:** The selected source files and applicable policies are evaluated completely.
- **Input or state space:** Eligible literal values across one or multiple selected files, literal forms, and the specified syntactic exclusions.
- **Invariant:** When the same eligible string value has at least three Unicode code points and occurs at least three times across the checked codebase, every eligible occurrence is reported. Occurrences excluded by `REQ-035` or `REQ-036` do not contribute to the count.
- **Boundaries:** Exercise two versus three occurrences, two versus three Unicode code points, occurrences split across files, single- and double-quoted literals, unsubstituted templates, and each specified exclusion. Include a two-code-point value made from supplementary-plane characters (four UTF-16 code units) to distinguish code-point counting from code-unit counting.
- **Test evidence:** `test/cli-repeated-string.test.js` — `PROP-REQ-034-01` cases cover cross-file occurrence and code-point thresholds, every REQ-035/REQ-036 exclusion, and static re-export module specifiers.
