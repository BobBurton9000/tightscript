# 2026-11-18 — Tightscript Task 009 policy-independence tests

- Type: Test coverage
- Scope: React and Next.js compatibility policy interactions
- Context and evidence: S5 selected TASK-009 from `.specflow/specs/react-next-compatibility/tasks.md`. The approved source and property artefacts require REQ-018 and REQ-031 exceptions to leave independently applicable Tightscript policies enforced.
- Decision or change: Added real-CLI temporary-project property tests in `test/cli-framework-policy-independence-property.test.js` covering eligible App Router and Pages Router exports alongside imported-value passthroughs, star exports, wrappers, local export lists and objects, preserved type/interface policies, and ineligible lowercase `get` names.
- Observed result: `node --test test/cli-framework-policy-independence-property.test.js` passed (2 tests). `npm test` passed (238 tests, 0 failures).
