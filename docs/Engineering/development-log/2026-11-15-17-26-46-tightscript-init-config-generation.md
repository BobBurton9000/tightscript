# 2026-11-15 — Add exclusive init configuration generation

- Type: Implementation
- Scope: CLI configuration initialization
- Context and evidence: TASK-003 implements the approved `REQ-037` and `REQ-038` behavior. The existing CLI validated configuration for checks but did not handle the `init` command. The approved design specifies exclusive creation of `tightscript.config.json` with the `**/*.ts` and `**/*.tsx` include patterns.
- Decision or change: Added `tightscript init` with exclusive file creation, refusal to replace an existing configuration, and cleanup of the file created by this command if writing or closing fails. Added real-CLI tests for the default scope, byte-for-byte preservation of existing valid and malformed configurations, and concurrent creation. Updated `.specflow/specs/tightscript/tasks.md` to mark TASK-003 complete. Files changed: `bin/tightscript.js`, `test-support/run-cli.js`, `test/cli.test.js`, and `.specflow/specs/tightscript/tasks.md`.
- Observed result: `npm test` passed all 15 tests on Node.js v26.13.1. `git diff --check` passed. The tests observed successful default-config creation, refusal without modifying either pre-existing fixture, and exactly one successful result from two concurrent init processes. The partial-write cleanup path is implemented but was not directly fault-injected.
- Related entries: [Strict CWD source-scope config loading](2026-11-15-17-17-44-strict-cwd-source-scope-config-loading.md)
