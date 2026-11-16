# 2026-11-15 — Tightscript design review

- Type: Design review
- Scope: `.specflow/specs/tightscript/design.md` for the Tightscript Feature.
- Context and evidence: Reviewed the complete approved `.specflow/specs/tightscript/requirements.md` and `design.md`, plus `VISION.md` and repository contents. `REQ-028` prohibits a property or function-parameter annotation when that annotation is an intersection; the earlier design wording could be read to include nested intersections. The user confirmed Unicode code-point counting for `REQ-034`. The repository contains no application source, package manifest, or test suite.
- Decision or change: Clarified the `REQ-028` design response to target top-level intersection annotations (ignoring parentheses) and explicitly leave nested intersections outside that rule. Kept the documented Unicode code-point interpretation for `REQ-034` following the user's choice.
- Lesson learned: Distinguish an annotation whose top-level type is an intersection from another annotation that merely contains a nested intersection.
- Observed result: Re-read the edited traceability row and confirmed the `REQ-034` response still records the selected code-point interpretation. No tests were run because the repository contains no application or test suite.
- Follow-up: The user may separately start Feature task generation for `.specflow/specs/tightscript/` if they accept the current design.
- Related entries: [Initial Tightscript feature design](2026-11-15-11-42-06-tightscript-feature-design.md)
