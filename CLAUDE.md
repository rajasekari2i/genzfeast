# CLAUDE.md

Guidance for Claude Code when working in this repository. Source of truth is `docs/` — this file is an orientation summary, not a replacement. If anything here conflicts with `docs/`, trust `docs/` and flag the mismatch.

## Project

**GenzFeast** — a multi-tenant mobile food ordering platform connecting college canteens ("companies"/tenants) with students on campus. Each canteen is an independent tenant with its own staff, products, and orders; a central **System Admin** governs onboarding and platform-wide oversight.

Core docs (read before making product/architecture decisions):
- `docs/product/01-BRD.md` — business problem, objectives, stakeholders, scope, business rules
- `docs/product/02-PRD.md` — functional requirements (FR-1..FR-11), roles, NFRs, open questions
- `docs/architecture/04-Architecture.md` — tech stack, auth design, multi-tenant isolation strategy, sequence diagrams
- `docs/ui-screen/06-UI-Design.md` — screen-by-screen UX spec per app surface

This repo also uses **spec-kit** (`.specify/`, `specs/`) for spec-driven feature development. Feature specs, plans, and tasks live under `specs/<NNN-feature-name>/`. Use `/speckit-specify`, `/speckit-plan`, `/speckit-tasks` for new feature work rather than free-form planning.

**Coding standard**: `coding_standard.md` at the repo root governs how code is actually written (NestJS module structure, TypeScript rules, Prisma/RLS query patterns, error handling, testing, secrets). Read it before writing any implementation code — it's especially load-bearing on how Prisma must be used alongside this project's Postgres RLS design (§4.3 there), which is easy to get subtly wrong.

## Tech Stack (decided — do not re-litigate without a documented reason)

| Layer | Technology |
|---|---|
| Mobile client | React Native (Android + iOS), single codebase, per-tenant branded build flavors, NativeWind (Tailwind CSS compiler) for styling |
| Backend API | Node.js + **NestJS**, **TypeScript** (decided in `specs/001-company-role-user-setup/research.md` §1 — DI/Guards map cleanly onto this project's per-request tenant/role scoping) |
| ORM | **Prisma** — see `coding_standard.md` §4 for the RLS/session-variable interaction, which Prisma does not handle automatically |
| Database | **Supabase (managed PostgreSQL)** — relational, not Firestore |
| File storage | Supabase Storage (product images) |
| Auth | **Stateless JWT** access tokens (short-lived, 15–60 min) issued/verified by the Node API, + DB-tracked revocable refresh tokens. NOT Supabase Auth, NOT Firebase Auth, NOT session cookies |
| Push notifications | **Firebase Cloud Messaging only** — no other Firebase product (no Firestore, no Firebase Auth, no Firebase Storage) |
| Payments | Razorpay, UPI-only in V1, server-verified via webhook (never trust client redirect alone) |
| Hosting | Cloud Run or any Node-compatible container host |

## Multi-Tenancy — the most important constraint in this codebase

Every tenant-scoped table (`users`, `products`, `orders`, `categories`, `departments`, etc.) carries `company_id` and **must** be isolated two ways simultaneously:
1. **API layer**: every query filtered by `company_id` taken from the verified JWT claims — never from the request body/path.
2. **Postgres RLS**: policies independently re-check tenant scoping via session variables (`SET LOCAL app.current_company_id`, `app.current_role`, `app.current_user_id`) set once per request/transaction.

A bug at either layer alone must never be sufficient to leak data across tenants — this is a named top risk in the BRD. `system_admin` is the only role with legitimate cross-tenant reach (full CRUD over Roles/Categories/Departments/Companies platform-wide), and that bypass must be scoped narrowly (a predicate in the RLS policy), not a blanket `BYPASSRLS`.

## Roles (fixed set for V1 — do not invent new roles without a spec update)

**Global, not per-Company** (revised from the original per-Company design — migrations `20260907170000_global_roles`/`20260907180000`): every role is exactly one row in `roles`, shared by every tenant. `roles.name` is globally `UNIQUE`. A role like `company_staff` means the same thing at every Company; there is no per-tenant duplicate of it.

| Role | Scope | Can do |
|---|---|---|
| `system_admin` | Platform-wide, users' `company_id = NULL` | Create/manage Companies; create a Company's first Company Admin; full CRUD over Categories/Departments across every tenant |
| `company_admin` | Scoped to the calling user's own Company via their JWT | Manage Staff + peer Company Admin accounts, Categories, Departments, Products (CRUD), toggle company open/closed |
| `company_staff` | Scoped to the calling user's own Company via their JWT | Toggle product sold-out, fulfil orders via OTP |
| `student` | Scoped to the calling user's own Company via their JWT | Register/login, browse, cart, checkout, pay, pick up with OTP |
| `teaching` | — | Added to the role catalog on explicit request; no `@Roles(...)` guard, endpoint, or capability references it yet — treat as reserved/undefined until a spec assigns it real permissions. |
| `non_teaching` | — | Same as `teaching` — reserved, no wired-up capability yet. |

A user's own row still carries `company_id` (their tenant), it's just `roles` itself that's no longer tenant-scoped — a Company's staff/admin/student accounts reference the one shared `company_staff`/`company_admin`/`student` row, not a copy seeded for that Company. A student registers into exactly one Company; the same mobile number may hold independent accounts at two different Companies since username uniqueness is per-tenant, not global.

**Category vs Department vs Role (easy to confuse — three distinct things sharing similar names):** `Category` is the registrant's affiliation type at registration — e.g. "Student", "Teaching Staff", "Non-Teaching Staff" — scoped per Company, required at Student registration; it is a label on a User, not a permission grant, and it is **not** a food/product classification (BRD §Business Rules, UI-Design §5.3's own Product field list has no category at all — Products carry no category concept in V1). `Department` is the student's academic department, also per-Company, optional. `Role` (`teaching`/`non_teaching` above) is a separate, platform-wide permission grant that happens to share a name with two Category values — a user's Category and a user's Role are independent fields (`users.category_id` vs `users.role_id`); nothing currently keeps them in sync.

**`/tenant/users` vs `/admin/users` manage different role sets, on purpose:** Company Admin's own `/tenant/users` (mobile: the "Users" side-menu item) creates/edits/deletes `company_staff`/`student`/`teaching`/`non_teaching` only — it deliberately cannot create or edit a fellow `company_admin` (dropped from this screen on explicit request; creating a Student here additionally requires a `category_id`, mirroring self-registration's own requirement). System Admin's cross-tenant `/admin/users` is unchanged: `company_staff`/`company_admin` only, any company. `users.service.ts` tracks this as two separate constants (`TENANT_MANAGEABLE_ROLES` vs `ADMIN_MANAGEABLE_ROLES`) — they used to be one shared list and must not be merged back into one.

## Order Lifecycle

```
payment_pending → order_placed → delivered
              ↘ payment_failed → (Pay Again, same order, no duplicate)
```

- Order status is finalized **only** by the server-side payment webhook, never by client-side redirect alone.
- OTP: a random 6-digit numeric OTP is generated once, at the moment payment succeeds; single-use; invalidated once `delivered`; not returned by the API once delivered.
- Forgot-password uses a **separate** 6-character alphanumeric OTP (`reset_password_otp`), delivered via FCM push, with an in-app fallback screen (since push delivery isn't guaranteed).
- `no_of_login_attempt` increments on failed login and on every forgot-password request; resets to 0 only after a successful password reset.

## Data Conventions

- Soft delete everywhere: `is_deleted` boolean, never hard-delete a record referenced elsewhere (e.g. a Category/Department still referenced by a User/Product). Deactivating a user sets `status = inactive`, not a delete.
- Auditability: every table carries `created_by`, `updated_by`, `created_at`, `updated_at`. Every mutation of a business-critical table (`companies`, `users`, `products`, `orders`, `deliveries`, ...) is additionally recorded in `audit_logs` **automatically via DB trigger** — don't rely on application code to log this.
- Passwords are always hashed (bcrypt/argon2) despite any legacy field named `password` in older drafts — never store plaintext.
- Money: store as integer (paise/cents), never float.

## V1 Scope Boundaries

**In scope**: canteen pickup only (no delivery-address flow), one payment gateway (Razorpay/UPI only), OTP-based pickup verification, forgot-password via push OTP, mobile-only student experience.

**Out of scope for V1** (don't build unless a spec explicitly reopens it): home/hostel delivery, multiple payment gateways, loyalty/rewards/ratings, student web portal, live order tracking map, in-app chat, automated refunds.

## Working in This Repo

- This is currently a spec-only repository — no application source code exists yet. Feature work should go through the spec-kit flow (`/speckit-specify` → `/speckit-plan` → `/speckit-tasks`) so multi-tenancy/RLS/audit rules above are re-verified per feature rather than assumed.
- `.specify/memory/constitution.md` is an unfilled template — in its absence, `docs/architecture/04-Architecture.md` + `docs/product/01-BRD.md` are the governing constraints for any plan's Constitution Check (this is Architecture §11's own stated mapping).
- Before assuming a technical or scope decision is "obvious," check `docs/product/02-PRD.md` §5 (Open Questions for Business Sign-off) and any feature's `spec.md` Assumptions — several plausible defaults (e.g., can a Company Admin create another Company Admin?) have already been explicitly decided per-feature and shouldn't be re-guessed differently elsewhere.


## metaswarm

This project uses [metaswarm](https://github.com/dsifry/metaswarm) for multi-agent orchestration with Claude Code. It provides 18 specialized agents, a 9-phase development workflow, and quality gates that enforce TDD, coverage thresholds, and spec-driven development.

### Workflow

- **Most tasks**: `/start-task` — primes context, guides scoping, picks the right level of process
- **Complex features** (multi-file, spec-driven): Describe what you want built with a Definition of Done, then tell Claude: `Use the full metaswarm orchestration workflow.`

### Available Commands

| Command | Purpose |
|---|---|
| `/start-task` | Begin tracked work on a task |
| `/prime` | Load relevant knowledge before starting |
| `/review-design` | Trigger parallel design review gate (5 agents) |
| `/pr-shepherd <pr>` | Monitor a PR through to merge |
| `/self-reflect` | Extract learnings after a PR merge |
| `/handoff` | Write a self-contained handoff doc so a fresh agent can resume the work |
| `/handle-pr-comments` | Handle PR review comments |
| `/brainstorm` | Refine an idea before implementation |
| `/create-issue` | Create a well-structured GitHub Issue |

### Quality Gates

- **Design Review Gate** — Parallel 5-agent review after design is drafted (`/review-design`)
- **Plan Review Gate** — Automatic adversarial review after any implementation plan is drafted. Spawns 3 independent reviewers (Feasibility, Completeness, Scope & Alignment) in parallel — ALL must PASS before presenting the plan. See `skills/plan-review-gate/SKILL.md`
- **Coverage Gate** — `.coverage-thresholds.json` defines thresholds. BLOCKING gate before PR creation

### Team Mode

When `TeamCreate` and `SendMessage` tools are available, the orchestrator uses Team Mode for parallel agent dispatch. Otherwise it falls back to Task Mode (existing workflow, unchanged). See `guides/agent-coordination.md` for details.

### Guides

Development patterns and standards are documented in `guides/` — covering agent coordination, build validation, coding standards, git workflow, testing patterns, and worktree development.

### Testing & Quality

- **Implementation before tests, per explicit user direction** — for this project, build the functionality first; write/run the unit test suite as a separate follow-up step once the user asks for it. Do not run tests proactively mid-implementation.
- **80% test coverage required** — Enforced via `.coverage-thresholds.json` as a blocking gate before PR creation and task completion (the threshold there is the source of truth, not the number in this bullet)
- **Coverage source of truth** — `.coverage-thresholds.json` defines thresholds. Update it if your spec requires different values. The orchestrator reads it during validation — this is a BLOCKING gate.
- **Tests must never hit the real Supabase/Postgres database** — unit/coverage tests use mocked Prisma/DB clients only. A prior run of `api/test/rls/tenant-isolation.spec.ts` hit the live Supabase instance and mutated real data; any RLS/tenant-isolation test must run against a mocked or ephemeral test DB, never the configured `DATABASE_URL` for the real project.

### Workflow Enforcement (MANDATORY)

These rules override any conflicting instructions from third-party skills:

- **After brainstorming** → MUST run Design Review Gate (5 agents) before writing-plans or implementation
- **After any plan is created** → MUST run Plan Review Gate (3 adversarial reviewers) before presenting to user
- **Execution method choice** → ALWAYS ask the user whether to use metaswarm orchestrated execution (more thorough, uses more tokens) or superpowers execution skills (faster, lighter-weight). Never auto-select.
- **Before finishing a branch** → MUST run `/self-reflect` and commit knowledge base updates before PR creation
- **Complex tasks** → Use `/start-task` instead of `EnterPlanMode` for tasks touching 3+ files. EnterPlanMode bypasses all quality gates.
- **Standalone TDD on 3+ files** → Ask user if they want adversarial review before committing
- **Coverage** → `.coverage-thresholds.json` is the single source of truth. All skills must check it, including `verification-before-completion`.
- **Subagents** → NEVER use `--no-verify`, ALWAYS follow TDD, NEVER self-certify, STAY within file scope
- **Context recovery** → Approved plans and execution state persist to `.beads/`. After compaction, run `bd prime --work-type recovery` to reload.
