# Tightscript Source Scope

For maintainers changing source discovery, this page records the approved include-pattern selection contract.

## Approved requirements

### TIGHTSCRIPT-REQ-006

- **Title:** Include patterns select every matching TypeScript source relative to invocation CWD

WHEN a Tightscript-specific source-scope setting supplies include patterns, THE SYSTEM SHALL inspect every matching `.ts` and `.tsx` file, evaluating each pattern relative to the process current working directory (CWD) when Tightscript is invoked.

## Correctness properties

### TIGHTSCRIPT-PROP-REQ-006-01

- **Sources:** `REQ-006`
- **Living requirements:** [Tightscript: include patterns select every matching TypeScript source relative to invocation CWD](./source-scope.md#tightscript-req-006)
- **Title:** Every matching source file is evaluated relative to invocation CWD
- **Preconditions:** The project has a valid Tightscript configuration with one or more include patterns.
- **Input or state space:** Vary the invocation CWD, include patterns, and matching or non-matching `.ts` and `.tsx` files.
- **Invariant:** Every `.ts` and `.tsx` file matched by the configured include patterns, evaluated relative to the process CWD at invocation, is inspected.
- **Boundaries:** Exercise both `.ts` and `.tsx`; include a matching file with a known violation and a non-matching control file.
- **Test evidence:** `test/cli-source-scope-property.test.js` — `PROP-REQ-006-01` cases verify invocation-CWD-relative matching, matching and non-matching files, and first-sorted paths for symlink aliases.
