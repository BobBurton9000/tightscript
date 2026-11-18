# React and Next.js Compatibility

For maintainers changing the framework compatibility analyser, this page records the approved React and Next.js contracts and their tested correctness properties. The compatibility decision consumes the existing Tightscript source scope; it does not alter it. The baseline callable-export and function-name policies remain documented in [Tightscript Export Policy](./exports.md) and [Tightscript Syntax Style](./syntax-style.md); this page defines their narrow framework exceptions. Imported-value and other validator policies remain independent.

## Approved requirements

## REACT-NEXT-COMPATIBILITY-REQ-001

- **Title:** Compatibility applies only to selected TypeScript and TSX files

WHEN Tightscript evaluates a project under this compatibility contract, THE SYSTEM SHALL apply the compatibility behavior only to selected `.ts` and `.tsx` files. JavaScript and JSX files MUST remain outside the checked source set.

## REACT-NEXT-COMPATIBILITY-REQ-002

- **Title:** Existing positive include patterns remain the source-selection authority

WHEN a React or Next.js project uses Tightscript, THE SYSTEM SHALL use the existing positive `include` patterns as the sole source-selection authority. The compatibility behavior MUST NOT add files to the selected source set. The project's include patterns MUST select authored source and MUST NOT select dependency or generated-output directories.

## REACT-NEXT-COMPATIBILITY-REQ-003

- **Title:** Framework compatibility preserves every unrelated Tightscript policy

THE SYSTEM SHALL continue to enforce every existing Tightscript policy except the specific REQ-018 and REQ-031 exceptions defined on this page. In particular, the system MUST continue to enforce Tightscript REQ-024, REQ-029, and REQ-030 without React- or Next-specific exceptions.

## REACT-NEXT-COMPATIBILITY-REQ-004

- **Title:** React component exports require checker acceptance and a local implementation

WHEN a selected module exports a callable value, THE SYSTEM SHALL exempt that export from Tightscript REQ-018 only if both conditions hold:

1. The TypeScript checker, using the consuming project's configured JSX settings and resolved React types, accepts the exported value as a JSX component type.
2. The callable implementation is declared in the same source file. An imported callable, a local alias whose initializer resolves only to an imported callable, and a re-export do not constitute a local implementation.

The implementation MAY be wrapped by one or more expressions only when a local callable implementation contributes to the exported component; its unrelated occurrence as a callback, property, or alternative branch is insufficient. An imported callable MAY supply a wrapper or decorator, but MUST NOT be a possible final exported component implementation. The TypeScript checker MUST recognize the final value as a JSX component type. A source path, export name, or `.tsx` extension alone MUST NOT qualify an export for this exception. In a Next.js project context, React component status alone MUST NOT exempt a callable export; it MUST qualify under REACT-NEXT-COMPATIBILITY-REQ-005.

## REACT-NEXT-COMPATIBILITY-REQ-005

- **Title:** Next.js callable exports require an entry in the closed convention table

WHEN a selected module is a recognized Next.js file-convention module, THE SYSTEM SHALL exempt a callable export from Tightscript REQ-018 only when all of the following conditions hold:

1. The consuming project's resolved Next.js major version, router, module file role, and export name are present in Tightscript's published Next.js compatibility table.
2. The callable implementation is local to the same source file.

The compatibility table MUST enumerate the supported major-version/router/file-role/export-name combinations. A file role or export name absent from that table MUST NOT receive an exception. Tightscript MUST determine a module's file role according to the documented default file-system routing conventions of the resolved Next.js major version, including nested routes and the documented project-root and supported `src/` layout rules. If project-specific configuration changes whether a selected module is recognized as one of the listed file roles, the Next.js REQ-018 exception MUST NOT apply to that module. If Tightscript cannot determine whether such configuration changes recognition for a selected module, it MUST fail closed and not grant the exception. If the module path is unrecognized or its role is indeterminate, the Next.js REQ-018 exception MUST NOT apply.

When a callable export is produced through a wrapper expression, its local callable implementation MUST contribute to the exported implementation; an unrelated callback, property, or alternative branch is insufficient. An imported callable MAY supply a wrapper or decorator, but MUST NOT be a possible final exported implementation. The TypeScript checker MUST establish that the final value is callable. Compatibility with slot-specific Next.js signatures or other framework-contract details MUST NOT be a condition for this REQ-018 exception; those checks remain the responsibility of Next.js tooling.

A callable export MUST NOT qualify solely because it is located beneath an `app`, `pages`, or `src` directory. The exception MUST NOT apply to arbitrary callable exports in convention files.

The current compatibility table contains the following entries. The table applies to Next.js 16.x in both routers; only the listed file-role/export-name pairs qualify. Roles may be located under the corresponding project-root directory or its supported `src/` equivalent.

| Next.js major | Router | File role | Callable export names |
| --- | --- | --- | --- |
| 16.x | App Router | `page`, `layout`, `template`, `default`, `error`, `global-error`, `not-found`, `loading`, `forbidden`, or `unauthorized` component module | `default` |
| 16.x | App Router | `page` or `layout` module | `generateMetadata`, `generateViewport`, `generateStaticParams` |
| 16.x | App Router | `route` handler module | `GET`, `HEAD`, `OPTIONS`, `POST`, `PUT`, `PATCH`, `DELETE` |
| 16.x | App Router or Pages Router | Project-level `proxy` module | `default`, `proxy` |
| 16.x | Pages Router | Page route module, excluding API routes and the special modules listed below | `default`, `getStaticProps`, `getStaticPaths`, `getServerSideProps` |
| 16.x | Pages Router | Special `_app`, `_document`, `_error`, `404`, or `500` module | `default` |
| 16.x | Pages Router | API route module | `default` |

Other major versions, file roles, and callable export names remain ineligible until explicitly added to this table. A later major version MUST NOT inherit the 16.x entries automatically.

## REACT-NEXT-COMPATIBILITY-REQ-006

- **Title:** Unresolved or unsupported Next.js context grants no exception

WHEN Tightscript cannot resolve the consuming project's Next.js version, cannot match a selected module to a supported file convention, or cannot establish that a callable export is locally implemented, THE SYSTEM SHALL NOT grant the Next.js REQ-018 exception. The callable export MUST remain subject to Tightscript REQ-018.

## REACT-NEXT-COMPATIBILITY-REQ-007

- **Title:** Compatibility exemptions do not bypass imported-value or export-list policies

WHEN Tightscript evaluates an export covered by the React or Next.js exception, THE SYSTEM SHALL continue to evaluate that export under Tightscript REQ-019 and REQ-020 independently. A compatibility exception MUST NOT suppress or bypass a REQ-019 or REQ-020 finding.

## REACT-NEXT-COMPATIBILITY-REQ-008

- **Title:** Imported-value passthroughs remain prohibited in framework modules

IF a callable value is imported and then exported unchanged, exported through `export *`, or exposed through a qualifying imported-value wrapper prohibited by Tightscript REQ-019, THEN THE SYSTEM SHALL report the applicable existing violation even when the exporting file is a React component module or a Next.js convention module.

## REACT-NEXT-COMPATIBILITY-REQ-009

- **Title:** The `get`-prefix exception is limited to exact Pages Router export bindings

WHEN a locally implemented callable export begins with the lowercase prefix `get` and occupies a documented callable export slot for a recognized Pages Router file convention, THE SYSTEM SHALL exempt that export from Tightscript REQ-031 only for that exact file role and export name. The local function or function-valued variable name checked under REQ-031 MUST exactly match the documented export name; exporting a differently named local binding under an eligible alias MUST NOT exempt its declaration. This includes documented page exports such as `getStaticProps`, `getStaticPaths`, and `getServerSideProps` when supported by the resolved Next.js version.

## REACT-NEXT-COMPATIBILITY-REQ-010

- **Title:** Other lowercase `get` names remain prohibited

WHEN a function or method name begins with the lowercase prefix `get` but is not a documented callable export for the exact recognized Next.js file role, THE SYSTEM SHALL continue to enforce Tightscript REQ-031.

## REACT-NEXT-COMPATIBILITY-REQ-011

- **Title:** Ineligible framework exports remain subject to existing policy

WHEN a React or supported Next.js callable export does not meet every condition for a compatibility exception, THE SYSTEM SHALL evaluate it under the existing Tightscript policies and MUST NOT report a pass by assuming framework intent.

## REACT-NEXT-COMPATIBILITY-REQ-012

- **Title:** Missing semantic information fails closed

WHEN required TypeScript, React, or Next.js semantic information cannot be resolved to determine whether a compatibility exception applies, THE SYSTEM SHALL fail closed and MUST NOT exempt the callable export.

## Correctness properties

## REACT-NEXT-COMPATIBILITY-PROP-REQ-004-01

- **Sources:** `REQ-004`, `REQ-005`, `REQ-006`, `REQ-011`, `REQ-012`
- **Living requirements:** [react-next-compatibility: React component exports require checker acceptance and a local implementation](#react-next-compatibility-req-004); [react-next-compatibility: Next.js callable exports require an entry in the closed convention table](#react-next-compatibility-req-005); [react-next-compatibility: unresolved or unsupported Next.js context grants no exception](#react-next-compatibility-req-006); [react-next-compatibility: ineligible framework exports remain subject to existing policy](#react-next-compatibility-req-011); [react-next-compatibility: missing semantic information fails closed](#react-next-compatibility-req-012)
- **Title:** Framework REQ-018 exemptions require positive proof
- **Preconditions:** A selected `.ts` or `.tsx` module has a callable export subject to REQ-018.
- **Input or state space:** React-only versus resolved Next.js project context; configured JSX semantics and resolved React types; direct or wrapped export values and their local or imported implementation provenance; for Next.js, resolved major version, router, file role, export name, and routing-relevant configuration; availability of required semantic information.
- **Invariant:** A callable export is exempt from REQ-018 only when it meets every applicable React or Next.js condition and a local callable implementation in the same source file is proven to contribute to the final exported value. An imported callable MUST NOT be a possible final exported implementation on any path. React eligibility requires the TypeScript checker to accept the final value as a JSX component type and does not apply in a Next.js project context. Next.js eligibility requires a supported compatibility-table entry, recognized convention role, local implementation, and checker-established callability. Project-specific configuration that changes whether the module is recognized as a listed role, or whose effect on that recognition is indeterminate, MUST NOT yield the exception. Slot-specific Next.js signatures or other framework-contract details MUST NOT be conditions for this exception. A known-ineligible export remains subject to REQ-018. If required semantic information is incomplete, the system fails closed and MUST NOT report PASS.
- **Boundaries:** Imported callables that may be final exported implementations, imported aliases, and re-exports; wrappers with an imported possible final value even when another branch is local; unrelated callback, property, or alternative-branch occurrences; rejected JSX component types; checker-callable Next.js exports with incompatible slot-specific signatures; unsupported Next.js versions, roles, or export names; root-versus-`src/` routing; Pages API and special routes; default, changed, and indeterminate routing configuration; unresolved required semantic information.
- **Test evidence:** `test/cli-framework-compatibility-property.test.js` — `[PROP-REQ-004-01] configured JSX modes accept components and reject non-components`, `[PROP-REQ-004-01] missing or unresolved React types fail closed`, `[PROP-REQ-004-01] direct and reviewed wrapped same-file implementations are eligible`, `[PROP-REQ-004-01] imports, aliases, re-exports, unrelated occurrences, unknown wrappers, and imported final branches retain REQ-018`, and `[PROP-REQ-004-01] a resolved Next.js project does not use React-only component eligibility`; `test/cli-next-compatibility-property.test.js` — `[PROP-REQ-004-01] Next.js 16.x accepts every listed router, file-role, and callable-export combination`, `[PROP-REQ-004-01] project-level proxy exports qualify for App Router, Pages Router, or both`, `[PROP-REQ-004-01] supported src layouts work and active project-root routers take precedence`, `[PROP-REQ-004-01] unsupported roles, names, and file boundaries retain REQ-018`, `[PROP-REQ-004-01] unsupported Next.js majors and unresolved package versions never pass`, and `[PROP-REQ-004-01] default, unchanged, changed, and indeterminate routing configuration is fail-closed`.

## REACT-NEXT-COMPATIBILITY-PROP-REQ-009-01

- **Sources:** `REQ-005`, `REQ-009`, `REQ-010`
- **Living requirements:** [react-next-compatibility: Next.js callable exports require an entry in the closed convention table](#react-next-compatibility-req-005); [react-next-compatibility: the `get`-prefix exception is limited to exact Pages Router export bindings](#react-next-compatibility-req-009); [react-next-compatibility: other lowercase `get` names remain prohibited](#react-next-compatibility-req-010)
- **Title:** REQ-031 exemption applies only to exact Pages Router exports
- **Preconditions:** A checked declaration has a function or method name beginning with the lowercase prefix `get`; a REQ-031 exception is considered only for a candidate callable export.
- **Input or state space:** Resolved Next.js version, router and file role; documented callable export slot; local declaration name and exported name; function and method names that do not occupy an eligible slot.
- **Invariant:** REQ-031 is exempted only for a locally implemented callable export whose local function or function-valued-variable declaration name exactly matches a supported Pages Router page slot (`getStaticProps`, `getStaticPaths`, or `getServerSideProps`). A declaration that merely aliases an imported callable, an export alias whose name differs from its local declaration, and all other lowercase `get` function or method names remain subject to REQ-031.
- **Boundaries:** Export aliases whose local declaration has a different name; a function-valued local alias to an imported callable even when its declaration name matches an eligible slot; API routes and special modules; resolved Next.js majors outside the supported compatibility table; unsupported routers or file roles; other lowercase `get` names.
- **Test evidence:** `test/cli-next-compatibility-property.test.js` — `[PROP-REQ-009-01] REQ-031 is exempt only for exact locally implemented Pages Router exports`, including its matching-local-export, differently named alias, imported callable, API/special-module, unsupported-major, and other-`get`-name cases.

## REACT-NEXT-COMPATIBILITY-PROP-REQ-007-01

- **Sources:** `REQ-003`, `REQ-007`, `REQ-008`, `REQ-009`, `REQ-010`
- **Living requirements:** [react-next-compatibility: framework compatibility preserves every unrelated Tightscript policy](#react-next-compatibility-req-003); [react-next-compatibility: compatibility exemptions do not bypass imported-value or export-list policies](#react-next-compatibility-req-007); [react-next-compatibility: imported-value passthroughs remain prohibited in framework modules](#react-next-compatibility-req-008); [react-next-compatibility: the `get`-prefix exception is limited to exact Pages Router export bindings](#react-next-compatibility-req-009); [react-next-compatibility: other lowercase `get` names remain prohibited](#react-next-compatibility-req-010)
- **Title:** Compatibility exemptions do not bypass other policies
- **Preconditions:** A selected module contains an export eligible for the REQ-018 exception or a local declaration eligible for the exact REQ-031 exception.
- **Input or state space:** An otherwise eligible framework export or declaration in a module that also contains violations of independently applicable Tightscript policies.
- **Invariant:** A compatibility exception suppresses only the finding permitted by its applicable requirement: REQ-018 for an eligible framework export, or REQ-031 for the exact local Pages Router declaration. Every other applicable policy continues to be evaluated and reported, including REQ-019 and REQ-020 and the preserved REQ-024, REQ-029, and REQ-030 constraints.
- **Boundaries:** Imported-value passthroughs and source re-exports; local export lists and exported object values; violations of the explicitly preserved interface and type policies; lowercase `get` function or method names outside exact eligible Pages Router slots.
- **Test evidence:** `test/cli-framework-policy-independence-property.test.js` — `[PROP-REQ-007-01] an eligible App Router export does not suppress independent export and import policies` and `[PROP-REQ-007-01] an exact Pages Router exception leaves other lowercase get names enforced`.

## REACT-NEXT-COMPATIBILITY-PROP-REQ-001-01

- **Sources:** `REQ-001`, `REQ-002`
- **Living requirements:** [react-next-compatibility: compatibility applies only to selected TypeScript and TSX files](#react-next-compatibility-req-001); [react-next-compatibility: existing positive include patterns remain the source-selection authority](#react-next-compatibility-req-002)
- **Title:** Compatibility does not expand the selected source set
- **Preconditions:** The consuming project uses positive `include` patterns to select authored `.ts` and `.tsx` source files and excludes dependency and generated-output directories.
- **Input or state space:** Matching and non-matching paths, including `.js`, `.jsx`, and TypeScript files outside the configured patterns.
- **Invariant:** Compatibility analysis operates only on `.ts` and `.tsx` roots already selected by the existing positive `include` patterns. It does not add framework files or virtual semantic probes to the policy source set.
- **Boundaries:** Unselected TypeScript files, JavaScript and JSX files, and synthetic semantic probes.
- **Test evidence:** `test/cli-source-scope-property.test.js` — `[PROP-REQ-001-01] React compatibility keeps policy roots within positive authored TypeScript includes`, `[PROP-REQ-001-01] Next.js compatibility does not add convention, generated, dependency, or JavaScript paths as policy roots`, and `[PROP-REQ-001-01] framework presence leaves init defaults and TypeScript-only selection unchanged`.
