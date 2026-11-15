# 2026-11-15 — Add diagnostic traceability coverage

- Type: Test
- Scope: CLI diagnostic reporting
- Context and evidence: TASK-023 verifies approved `REQ-004` and `PROP-REQ-004-01`. The property requires every policy diagnostic to identify its affected file, source location, and requirement ID, including findings from multiple policy rules and files.
- Decision or change: Added a table-driven real-CLI integration test with temporary TypeScript sources and a temporary Git repository for comment-link cases. The fixtures exercise each policy diagnostic requirement ID, include multiple findings in one file and across files, and assert every diagnostic's file, line, column, and requirement ID. Updated `.specflow/specs/tightscript/tasks.md` to mark TASK-023 complete. Files changed: `test/cli-diagnostics-property.test.js` and `.specflow/specs/tightscript/tasks.md`.
- Observed result: `node --test test/cli-diagnostics-property.test.js` passed. `npm test` passed all 97 tests on Node.js v26.13.1 with TypeScript 5.9.3. The repository had no installed TypeScript dependency, so verification temporarily resolved the existing TypeScript 5.9.3 npm-cache package through a local symlink; the temporary symlink was removed after testing. No package metadata was changed.
