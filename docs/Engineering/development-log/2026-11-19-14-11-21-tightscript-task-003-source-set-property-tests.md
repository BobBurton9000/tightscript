# 2026-11-19 — Tightscript TASK-003 source-set property tests

- Type: Property verification
- Scope: Next.js source-set boundaries for `TASK-003` (`REQ-007`, `PROP-REQ-007-01`); changed files: `test/cli-source-scope-property.test.js` and `.specflow/specs/next-routing-config-resolution/tasks.md`.
- Context and evidence: The approved task requires real-CLI evidence that Next.js routing analysis preserves configured positive include patterns as the only policy-root selector and does not add convention, generated, dependency, or JavaScript files.
- Decision or change: Tagged the Next.js source-scope CLI case with `PROP-REQ-007-01`, added a selected `.tsx` source alongside the selected `.ts` source, and asserted findings are limited to those selected files while the convention, generated, dependency, and JavaScript paths remain excluded.
- Observed result: `node --test test/cli-source-scope-property.test.js test/source-scope.test.js` passed (9 tests, 0 failures). `git diff --check` passed.
