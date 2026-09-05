# GenzFeast — Documentation Set (v2)

> **v2 change log:** Database moved from Firebase/Firestore to **Supabase (PostgreSQL)**. **Firebase is now used only for Cloud Messaging (push notifications)** — no other Firebase product is part of this architecture. Authentication is now **stateless JWT** (short-lived access token + revocable, database-tracked refresh token). A generic `audit_logs` table (populated via Postgres triggers) has been added to the Data Model and wired into every module that touches business-critical tables. See 01-BRD.md §7 for the updated assumptions list.

Generated from the original high-level PRD. Read in this order:

1. **01-BRD.md** — Business Requirements Document (why we're building this, scope, assumptions)
2. **02-PRD.md** — Product Requirements Document (functional requirements, flows, acceptance criteria)
3. **03-Data-Model.md** — Firestore collections, fields, relationships, security rules
4. **04-Architecture.md** — Tech stack, multi-tenancy strategy, system diagrams, payment sequence
5. **05-Modules.md** — Implementation modules index (1:1 with build phases / agent sessions); each module also has its own file under `modules/` for handing to a separate agent/session:
   - `modules/Module-1-Platform-Admin.md`
   - `modules/Module-2-Tenant-Administration.md`
   - `modules/Module-3-Staff-Fulfilment.md`
   - `modules/Module-4-Student-Auth.md`
   - `modules/Module-5-Browsing-and-Cart.md`
   - `modules/Module-6-Checkout-and-Payment.md`
   - `modules/Module-7-Student-Profile.md`
   - `modules/Module-8-My-Orders.md`
6. **06-UI-Design.md** — Screen-by-screen UI specs and navigation maps

## How to use this with Claude Code (spec-kit / metaswarm style)

- Treat **01-BRD** + **04-Architecture** as the "constitution" — invariant ground rules.
- Treat **02-PRD** + **03-Data-Model** as the "specify" layer — what to build.
- Treat **05-Modules** as the "plan" — hand one module to one agent/session at a time, in the build order listed at the bottom of that document.
- Treat **06-UI-Design** as the shared reference every module's frontend work should match.

## Open items requiring a business decision

These are called out inline (marked "assumption" or "open question") in the BRD and PRD, and should be resolved before or during early implementation:
- Single shared codebase with per-tenant build flavors vs. fully separate codebases (Architecture §3 — shared codebase recommended).
- Whether "Department" is mandatory at student registration.
- Login-attempt lockout threshold/duration.
- Whether a Company Admin can create other Company Admins.
- Behavior of `is_open = false` on existing logged-in sessions.
- Exact access-token and refresh-token lifetimes (Architecture §4 suggests 15–60 min / 7–30 days as a starting point).
