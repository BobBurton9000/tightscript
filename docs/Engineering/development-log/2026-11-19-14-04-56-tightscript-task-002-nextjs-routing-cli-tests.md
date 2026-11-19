# 2026-11-19 — Tightscript TASK-002 Next.js routing CLI tests

- Type: Property verification
- Scope: `test/framework-context.test.js` and `test/cli-next-compatibility-property.test.js`; SpecFlow task `TASK-002` in `.specflow/specs/next-routing-config-resolution/tasks.md`.
- Context and evidence: Approved `TASK-002` calls for real-CLI evidence of default, changed, and indeterminate routing outcomes, the existing convention boundary, and non-execution of project configuration. `TASK-001` had already established the routing classifications and unit-level cases.
- Decision or change: Added property-tagged CLI cases for omitted `pageExtensions` with dynamic unrelated properties, explicit and shorthand defaults, changed static values, and indeterminate values and object shapes. Retained the existing listed/unlisted convention-table checks and tagged them for `PROP-REQ-005-01`. Tagged the context and CLI marker-file cases for `PROP-REQ-006-01`.
- Observed result: `node --test test/framework-context.test.js test/cli-next-compatibility-property.test.js` passed (99 tests, 0 failures). `git diff --check` passed.
