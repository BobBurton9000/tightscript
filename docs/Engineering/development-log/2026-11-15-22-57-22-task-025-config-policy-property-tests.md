# 2026-11-15 — TASK-025 Configuration Policy Property Tests

- Type: Test implementation
- Scope: CLI configuration policy; TASK-025 and PROP-REQ-008-01
- Context and evidence: The approved task requires real-CLI coverage showing that configuration cannot weaken fixed policy and that positive include-pattern selection remains usable. The current CLI rejects every unsupported top-level setting.
- Decision or change: Added `test/cli-config-property.test.js` with cases for rule selection/configuration, threshold changes, file exclusions, per-file overrides, suppressions, and a positive include-pattern selection with selected and non-selected violations. No implementation or approved specification artefacts were changed.
- Observed result: `node --test --test-name-pattern='prohibited policy weakening settings are rejected' test/cli-config-property.test.js` passed all 6 tests. `node --test test/cli-config-property.test.js` passed those 6 tests but the positive include-pattern case could not complete analysis: the CLI reported `Cannot find package 'typescript'`. `node --version` reported `v26.13.1`; `npm ls typescript --depth=0` showed no local TypeScript dependency, and direct package resolution failed with `ERR_MODULE_NOT_FOUND`.
- Follow-up: Make a supported TypeScript peer dependency available in the verification environment, then rerun `node --test test/cli-config-property.test.js` before considering the task verified.
