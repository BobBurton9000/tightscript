# 2026-11-15 — Tightscript feature design

- Type: Feature design
- Scope: Tightscript architecture and verification design.
- Context and evidence: The approved requirements are in `.specflow/specs/tightscript/requirements.md`. The repository contains no application source, package manifest, or test suite. The user selected a Node.js CLI, current-directory-only config lookup, and traversal of all directory symlinks with cycle detection.
- Decision or change: Created `.specflow/specs/tightscript/design.md` with the proposed CLI/config interface, component boundaries, source-scope and error handling, policy traceability for all 37 requirement IDs, security/operational considerations, and verification strategy. No tasks or application code were created or changed.
- Observed result: A Python 3 check found all 37 requirement IDs referenced in the design and confirmed the relative links to `requirements.md` and `VISION.md` resolve. No tests were run because this was design-only work. The design path is ignored by `.gitignore` (`.specflow`); it exists in the working tree but is not reported by ordinary Git status.
- Follow-up: The supported Node.js minimum and TypeScript compiler version range remain release constraints to select before implementation.
