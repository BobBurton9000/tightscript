# 2026-11-18 — Verify exact Pages Router REQ-031 exception

- Type: Test coverage
- Scope: Next.js Pages Router export-name validation (TASK-008)
- Context and evidence: The approved `PROP-REQ-009-01` requires REQ-031 to be exempted only for locally implemented exports whose local name exactly matches an eligible Pages Router page slot; aliases, imported callables, ineligible roles, unsupported versions, and other `get` names remain subject to REQ-031.
- Decision or change: Extended `test/cli-next-compatibility-property.test.js` with real-CLI temporary-project cases for matching local `getStaticProps`, `getStaticPaths`, and `getServerSideProps` exports; differently named aliases; same-named bindings to imported callables; API and special modules; unsupported Next.js majors; and other lowercase `get` functions and methods.
- Observed result: `node --test test/cli-next-compatibility-property.test.js` passed (24 tests, 0 failures). `node --test test/cli-next-compatibility-property.test.js test/cli-framework-compatibility.test.js test/cli-syntax-style.test.js` passed (36 tests, 0 failures).
