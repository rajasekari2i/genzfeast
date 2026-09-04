# GenzFeast — Documentation Set

Generated from the original high-level PRD. Read in this order:

1. **01-BRD.md** — Business Requirements Document (why we're building this, scope, assumptions)
2. **02-PRD.md** — Product Requirements Document (functional requirements, flows, acceptance criteria)
3. **03-Data-Model.md** — Firestore collections, fields, relationships, security rules
4. **04-Architecture.md** — Tech stack, multi-tenancy strategy, system diagrams, payment sequence
5. **05-Modules.md** — Implementation modules (1:1 with build phases / agent sessions)
6. **06-UI-Design.md** — Screen-by-screen UI specs and navigation maps

## How to use this with Claude Code (spec-kit / metaswarm style)

- Treat **01-BRD** + **04-Architecture** as the "constitution" — invariant ground rules.
- Treat **02-PRD** + **03-Data-Model** as the "specify" layer — what to build.
- Treat **05-Modules** as the "plan" — hand one module to one agent/session at a time, in the build order listed at the bottom of that document.
- Treat **06-UI-Design** as the shared reference every module's frontend work should match.

## Open items requiring a business decision

These are called out inline (marked "assumption" or "open question") in the BRD and PRD, and should be resolved before or during early implementation:
- Firestore vs Realtime Database confirmation (Architecture §2 — Firestore recommended).
- Single shared codebase with per-tenant build flavors vs. fully separate codebases (Architecture §3 — shared codebase recommended).
- Whether "Department" is mandatory at student registration.
- Login-attempt lockout threshold/duration.
- Choice of payment gateway for V1.
- Whether a Company Admin can create other Company Admins.
- Behavior of `is_open = false` on existing logged-in sessions.
