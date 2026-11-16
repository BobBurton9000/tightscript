# 2026-11-16 — Place Tightscript policy documents beside their source modules

- Type: Documentation relocation
- Scope: Tightscript policy documents in `bin/` and their source declaration links.
- Context and evidence: The user directed that maintained behavior documentation be placed beside the source modules rather than under the repository's general `docs/` directory. The localized Product pages already held 37 requirements and 11 correctness properties across 15 behavior areas.
- Decision or change: Moved all 15 Markdown documents from `docs/Product/` to adjacent sidecars under `bin/`, preserving their contents, living identifiers, and cross-document links. Changed 73 implementation declaration links from the Product directory to sibling-document links. Removed the now-empty Product directory. No executable behavior, tests, or temporary specification artefacts were changed.
- Observed result: Static checks validated all 37 requirements, 11 properties, 73 source links, and all inter-document links at their new paths. `node --check` passed for all JavaScript modules in `bin/`; `npm test` passed using Node.js v26.13.1 and the pre-existing TypeScript 5.9.3 workspace installation via a temporary symlink, which was removed without installing dependencies. `git diff --check` passed. No files under `.specflow/` were changed.
