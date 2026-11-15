# 2026-11-15 — Verify init preserves existing configurations

- Type: Test coverage
- Scope: CLI configuration initialization; TASK-022
- Context and evidence: Approved TASK-022 verifies REQ-038 and PROP-REQ-038-01. The existing init command is exercised through the real CLI using isolated temporary projects; the property requires failure and byte-for-byte preservation for existing valid and malformed configuration files.
- Decision or change: Added `test/cli-init-property.test.js` with separate PROP-REQ-038-01 cases for valid and malformed pre-existing configurations. Updated only TASK-022's checkbox in `.specflow/specs/tightscript/tasks.md` after the task-specific tests passed.
- Observed result: On Node.js v26.13.1, `node --test test/cli-init-property.test.js` passed both cases. `npm test` was also run but failed across policy-analysis tests because the TypeScript package is not installed (`Cannot find package 'typescript' imported from .../bin/comment-validator.js`); that broader suite result does not invalidate the passing TASK-022 CLI initialization cases.
