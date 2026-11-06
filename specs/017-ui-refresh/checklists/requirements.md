# Specification Quality Checklist: Mobile App UI Refresh

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

**Re-validated 2026-11-06 after eight spec amendments and three adversarial review rounds.** Revision 1 of this checklist claimed "validated on first pass; no spec revisions were required" — eight were subsequently required. That claim was wrong and is retracted.

**Amendments applied since first validation** (see `research.md` summary): two grounds (FR-003/003a); the measured type scale with no numeric weights anywhere (FR-007/007a); the twelve-step radius scale (FR-008); build-time vs runtime font failure separated (Edge Cases); the contrast gate reduced to a single fill pairing and made warn-and-fallback (FR-010/SC-008); corrected screen counts (SC-002); SC-004/FR-002 extended to class names, including off-palette ones; four new assumptions.

**Retracted from revision 1 of this checklist:**
- *"SC-008 … rejected at build time"* — it warns and falls back; it never fails a build.
- *"the contrast gate re-pointed"* — it is **narrowed to one leg**. Keeping two legs was proven to reject every colour in the sRGB gamut.
- *"Planning must establish whether any such canteen exists"* — withdrawn. `resolveBrandTheme` has no production call site and no tenant brand configuration exists in the repo, so there is nothing to audit and no build that can break.

**Judgement calls that still stand:**
- Hex values and typeface names remain in the spec: for a visual refresh the exact palette *is* the requirement. No framework, file path or language appears.
- Sizes are abstract "units", keeping the spec device-agnostic.
- SC-004 and SC-008 touch build-time concerns, retained because both are objectively verifiable.

**Known imprecision, accepted:** FR-019 and SC-007 say "26 screens with a supplied artboard". 26 is the **artboard** count; the screen count is 21 (27 files − 6 undesigned), because `OrderDetailScreen` and `ProductListScreen` each carry two artboards and the drawer carries three. The artboard count is the useful number for review, and `quickstart.md`'s table enumerates the mapping explicitly.
