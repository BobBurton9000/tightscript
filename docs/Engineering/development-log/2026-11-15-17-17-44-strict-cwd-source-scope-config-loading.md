# 2026-11-15 — Strict CWD source-scope config loading

- Type: Implementation
- Scope: CLI source-scope configuration loading and validation
- Context and evidence: TASK-002 implements the approved `REQ-008` and `REQ-039` configuration boundary. Before this change, the CLI checked only whether the CWD configuration file existed; it did not parse or validate its contents.
- Decision or change: Read and parse `tightscript.config.json` from the invocation CWD. Reject malformed JSON, non-object configurations, absent or empty `include` arrays, empty/non-string patterns, unknown settings, and negated patterns as source-scope configuration errors. Add real-CLI tests for a valid positive include configuration and invalid configurations.
- Observed result: `npm test` passed all 10 tests on Node.js v26.13.1, including malformed JSON, missing/empty scope, unknown setting, negated-pattern, and empty-pattern cases. A valid include configuration passed source-scope validation and reached the existing not-yet-implemented policy evaluator.
