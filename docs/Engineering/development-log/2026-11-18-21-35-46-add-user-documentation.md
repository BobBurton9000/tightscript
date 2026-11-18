# 2026-11-18 — Add user documentation

- Type: Documentation and packaging metadata
- Scope: Root README, user guide, and npm package contents
- Context and evidence: The repository had no root README or user-oriented guide. `package.json` exposed only `bin/` in its package file list, while the policy requirements and tested configuration behaviour were documented in `bin/*.md` and the CLI.
- Decision or change: Added a root README with installation, source-scope setup, command usage, and links to a practical TypeScript guide. Added `docs/writing-code-that-passes-tightscript.md` covering the implemented code policies, compliant examples, source-scope cautions, framework exceptions, diagnostics, and detailed policy references. Added the guide to the npm package file list so it ships alongside the README and policy pages.
- Observed result: `npm test` passed all 241 tests. `npm pack --dry-run` listed the README, the guide, and `bin/` policy pages. A temporary project containing the guide's `Invoice` example returned `PASS`. Relative Markdown links resolved and whitespace checks passed; `git diff --check` reported no errors.
