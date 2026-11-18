# Tightscript Export Policy

For maintainers changing export validation, this page records the approved callable, local-export, and object-shaped export contracts.

## Approved requirements

### TIGHTSCRIPT-REQ-018

- **Title:** Callable standalone exports are prohibited outside approved framework exceptions

WHEN a checked module exports a standalone function or callable value, directly or through a named re-export or `export *`, THE SYSTEM SHALL report a violation if the exported value is callable, unless that specific export qualifies under the [React component compatibility contract](./framework-compatibility.md#react-next-compatibility-req-004) or the [Next.js convention compatibility contract](./framework-compatibility.md#react-next-compatibility-req-005). Type-only exports MUST NOT be treated as callable-value exports.

### TIGHTSCRIPT-REQ-020

- **Title:** Local values are exported inline

WHEN a locally declared value is exported through a separate local export list instead of an inline export declaration, THE SYSTEM SHALL report a violation. Source-module re-exports are exempt from this requirement.

### TIGHTSCRIPT-REQ-021

- **Title:** Exported object-shaped constant values are prohibited

WHEN a module exports a `const` binding initialized with an object literal, a class instance, or `Object.freeze({ ... })`, whether through an inline named export or as the target of a default export, or directly default-exports one of those expressions, THE SYSTEM SHALL report a violation.

## Correctness properties

### TIGHTSCRIPT-PROP-REQ-018-01

- **Sources:** `REQ-018`
- **Living requirements:** [Tightscript: callable exports are rejected unless an approved framework exception applies](./exports.md#tightscript-req-018)
- **Title:** Callable value exports fail unless a framework exception is proven
- **Preconditions:** The checked module graph permits the TypeScript semantic analysis needed to determine whether exported values are callable.
- **Input or state space:** Direct exports of standalone functions or callable values, named re-exports, `export *`, type-only exports, and React or Next.js compatibility eligibility.
- **Invariant:** A module fails the policy check when it exports a callable value directly or through a named re-export or `export *`, unless that specific export is positively eligible under the [React component compatibility contract](./framework-compatibility.md#react-next-compatibility-req-004) or the [Next.js convention compatibility contract](./framework-compatibility.md#react-next-compatibility-req-005). A type-only export is not treated as a callable-value export.
- **Boundaries:** Include callable and non-callable values, named re-exports, star re-exports, and type-only exports; verify that eligible local React components and supported Next.js exports avoid REQ-018 while ineligible exports retain it.
- **Test evidence:** `test/cli-export-property.test.js` — `PROP-REQ-018-01` cases cover direct callable and non-callable values, named and star re-exports, type-only exports, and unresolved callability information; `test/cli-framework-compatibility-property.test.js` — `[PROP-REQ-004-01] direct and reviewed wrapped same-file implementations are eligible`; `test/cli-next-compatibility-property.test.js` — `[PROP-REQ-004-01] Next.js 16.x accepts every listed router, file-role, and callable-export combination`.
