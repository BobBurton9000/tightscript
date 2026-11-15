# 2026-11-15 — TASK-016 callable export policy resolution

- Type: Feature implementation
- Scope: REQ-018 callable exports and real-CLI verification
- Context and evidence: The initial TASK-016 implementation reported callable local exports through `export { localFunction }`, while an existing exact-output test expected only REQ-020. Exempting the local export-list form would leave the same callable exposed through a syntax variation, contrary to REQ-018's policy intent.
- Decision or change: Treated callable local export lists as REQ-018 violations as well as REQ-020 violations, and updated the existing CLI expectation without weakening either requirement. Kept the direct-export, source-module named-re-export, `export *`, type-only exclusion, and unresolved-callability cases.
- Observed result: `node --test test/cli-export.test.js` passed all 5 tests. `npm test` passed all 63 tests. Verification used Node.js v26.13.1 and TypeScript 5.9.3.
- Related entries: [Initial TASK-016 implementation and blocked verification](2026-11-15-20-50-22-tightscript-callable-export-analysis-task-016.md)
