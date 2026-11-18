# 2026-11-18 — Tightscript TASK-004 compatibility CLI integration

- Type: Feature implementation
- Scope: CLI framework-compatibility evaluation and REQ-018 export validation
- Context and evidence: Approved TASK-004 depends on completed TASK-003 and requires compatibility decisions to affect only REQ-018 for positively eligible exports, while incomplete required analysis fails with REQ-005 and independent validators remain active.
- Decision or change: Integrated the compatibility analyser into the CLI and passed its eligible route identities to the export validator. Only those routes skip REQ-018; REQ-020 and the other validators continue independently. The CLI evaluates React compatibility when JSX mode is configured and evaluates Next.js compatibility when Next.js resolves, leaving ordinary non-JSX projects on their existing path. Added real-CLI cases for eligible React and Next.js exports, ineligible React callables, incomplete JSX semantics, and independent REQ-020 reporting. Changed files: `bin/tightscript.js`, `bin/export-validator.js`, and `test/cli-framework-compatibility.test.js`.
- Observed result: `node --test test/cli-framework-compatibility.test.js` passed (5 tests). `npm test` passed (200 tests, 0 failures).
