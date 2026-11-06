# CLAUDE.md

Guidance for Claude Code when working in this repository. Source of truth is the **code** first, then `docs/` — this file is an orientation summary, not a replacement. If anything here conflicts with the code, trust the code and flag the mismatch.

## Project

**GenzFeast** — a multi-tenant mobile food ordering platform connecting college canteens ("companies"/tenants) with students and staff on campus. Each canteen is an independent tenant with its own staff, products, and orders; a central **System Admin** governs onboarding and platform-wide oversight.

**Status: V1 is built and functional.** 16 feature specs (`specs/001-…` → `specs/016-…`) have been implemented across a working backend and mobile client. This is no longer a spec-only repository.

### Repo layout

| Path | What it is |
|---|---|
| `api/` | NestJS 10 + TypeScript backend. `api/src/<module>/` per bounded concern; `api/prisma/` schema + hand-edited migrations; `api/test/{unit,contract,rls}` |
| `mobile/` | React Native 0.86 (bare CLI, **not Expo**) client. **Android only — there is no `ios/` directory** |
| `docs/` | BRD, PRD, Architecture, UI design |
| `specs/` | spec-kit feature specs; 13 of 16 ship a `contracts/openapi.yaml` |
| `coding_standard.md` | How code must be written. Load-bearing |

### Core docs

- `docs/product/01-BRD.md` — business scope, business rules, **§11 Known Gaps**, §12 next phase *(reconciled with the code, v2.0)*
- `docs/product/02-PRD.md` — FR-1..FR-16, each marked Built / Built (changed) / Not built with its implementing endpoint; §6 resolved questions, §7 still open *(reconciled, v2.0)*
- `docs/architecture/04-Architecture.md` — stack, module/route map, tenant isolation, OTP routing, §13 what a web client would need *(reconciled, v3.0)*
- `docs/ui-screen/06-UI-Design.md` — screen-by-screen UX spec. **Not yet reconciled with the build** — treat as the original design intent, not as a description of the shipped screens

**Coding standard**: `coding_standard.md` governs how code is actually written (NestJS module structure, TypeScript rules, Prisma/RLS query patterns, error handling, testing, secrets). Read it before writing any implementation code — it's especially load-bearing on how Prisma must be used alongside this project's Postgres RLS design (§4.3 there), which is easy to get subtly wrong.

**spec-kit**: feature specs, plans and tasks live under `specs/<NNN-feature-name>/`. Use `/speckit-specify`, `/speckit-plan`, `/speckit-tasks` for new feature work rather than free-form planning.

## Tech Stack (decided — do not re-litigate without a documented reason)

| Layer | Technology |
|---|---|
| Mobile client | **React Native 0.86 (bare CLI, not Expo)**, React 19, TypeScript 5.9. **Android only today** — no iOS project exists. Per-tenant branded builds; NativeWind 4 over Tailwind 3 for styling |
| Mobile navigation | React Navigation 7 — a single role-routed drawer shell (`mobile/src/navigation/AppShell.tsx`), **not** separate apps per role |
| Backend API | Node.js + **NestJS 10**, **TypeScript** (decided in `specs/001-company-role-user-setup/research.md` §1 — DI/Guards map cleanly onto this project's per-request tenant/role scoping) |
| ORM | **Prisma 5** — see `coding_standard.md` §4 for the RLS/session-variable interaction, which Prisma does not handle automatically. `schema.prisma` is **not** the full source of truth: RLS policies, triggers, CHECK constraints and partial unique indexes are hand-written into migration SQL |
| Database | **Supabase (managed PostgreSQL)** — relational, not Firestore |
| File storage | Railway Bucket (S3-compatible object storage; product images) via `@aws-sdk/client-s3`. Private-only — served via this API's own `GET /products/image/:key` proxy route, not a direct public bucket URL |
| Auth | **Stateless JWT (HS256)** access tokens issued/verified by the Node API (default TTL 1800s, `JWT_ACCESS_TOKEN_TTL_SECONDS`), + DB-tracked revocable refresh tokens (opaque bytes, SHA-256 hashed, default 14d). NOT Supabase Auth, NOT Firebase Auth, NOT session cookies |
| Password hashing | **Argon2id** via a single shared `PasswordService` — every path that hashes a password goes through it |
| Push notifications | **Firebase Cloud Messaging only** — no other Firebase product (no Firestore, no Firebase Auth, no Firebase Storage) |
| SMS | **MSG91** — `specs/014-msg91-sms-otp-mobile-verification`. Registration-time mobile verification, and (per-Company `companies.is_sms`) forgot-password OTP delivery; order-pickup OTP stays FCM-only regardless of `is_sms`. Each distinct message has its own DLT-approved template |
| Payments | Razorpay, UPI-only in V1, server-verified via webhook (never trust client redirect alone) |
| Config | Zod schema validated at boot. A missing **required** var fails startup; every third-party integration (Railway/Firebase/Razorpay/MSG91) is **optional** and fails at its own request instead |
| Hosting | Cloud Run or any Node-compatible container host |

## Multi-Tenancy — the most important constraint in this codebase

Every tenant-scoped table (`users`, `products`, `orders`, `categories`, `departments`, `feedback`, etc.) carries `company_id` and **must** be isolated two ways simultaneously:

1. **API layer**: every query filtered by `company_id` taken from the verified JWT claims — never from the request body/path.
2. **Postgres RLS**: policies independently re-check tenant scoping via session variables (`app.current_company_id`, `app.current_role`, `app.current_user_id`, `app.current_system_actor`), set transaction-locally via `set_config(..., true)` at the start of every transaction.

A bug at either layer alone must never be sufficient to leak data across tenants — this is a named top risk in the BRD. 16 tables have RLS enabled.

**Two things make this real, and both are easy to accidentally break:**

- **`TenantPrismaService.runInTenantContext()` is the ONLY sanctioned DB entry point.** No service may inject `PrismaClient` directly. Every operation runs inside a Prisma interactive transaction whose first statement sets the session variables.
- **The app connects as `app_user`** (`APP_DATABASE_URL`) — a non-superuser that owns no tables. RLS is bypassed entirely by a superuser or table owner, so connecting as either silently disables the whole second layer. `DATABASE_URL` (owner) is migration/CLI-only and is deliberately excluded from the app's config schema.

**Bypasses are narrow policy predicates, never `BYPASSRLS`.** `system_admin` gets cross-tenant reach only on the tables it legitimately needs. Non-request paths (payment webhook, pre-auth login lookup, seed scripts) use a **system-actor** context matched by its own named policies.

## Roles (fixed set for V1 — do not invent new roles without a spec update)

**Global, not per-Company** (revised from the original per-Company design — migrations `20260907170000_global_roles`/`20260907180000`): every role is exactly one row in `roles`, shared by every tenant. `roles.name` is globally `UNIQUE`. A role like `company_staff` means the same thing at every Company; there is no per-tenant duplicate of it.

**Roles are not CRUD-able by anyone.** The catalog is seeded. `app_user` has `SELECT` only on `roles` — no `INSERT`/`UPDATE` grant exists; only a `SECURITY DEFINER` function may write it.

| Role | Scope | Can do |
|---|---|---|
| `system_admin` | Platform-wide, users' `company_id = NULL` | Create/manage **Companies**; create a Company's first Company Admin; manage `company_admin`/`company_staff` accounts in any tenant. **Has no UI of any kind — API only.** |
| `company_admin` | Own Company via JWT | Manage `company_staff`/`student`/`teaching`/`non_teaching` accounts, Categories, Departments, Products (CRUD + image), review/resolve Feedback |
| `company_staff` | Own Company via JWT | Toggle product sold-out, fulfil orders via pickup code |
| `student` | Own Company via JWT | Register/login, browse, cart, checkout, pay, pick up with code |
| `teaching` | Own Company via JWT | **Reserved.** Can be created and log in, but has no ordering capability. Appears in exactly one `@Roles(...)` allowlist (`GET /me/contact-us`) plus the role-agnostic `/me/*` routes (profile, change-password, devices, feedback) |
| `non_teaching` | Own Company via JWT | Same as `teaching` |

A user's own row still carries `company_id` (their tenant); it's just `roles` itself that's no longer tenant-scoped. A student registers into exactly one Company; the same mobile number may hold independent accounts at two different Companies since username uniqueness is per-tenant, not global.

**Category vs Department vs Role (easy to confuse — three distinct things sharing similar names):** `Category` is the registrant's affiliation type at registration — e.g. "Student", "Teaching Staff", "Non-Teaching Staff" — scoped per Company, required at Student registration; it is a label on a User, not a permission grant, and it is **not** a food/product classification (Products carry no category concept in V1). `Department` is the student's academic department, also per-Company, optional. `Role` (`teaching`/`non_teaching` above) is a separate, platform-wide permission grant that happens to share a name with two Category values — a user's Category and Role are independent fields (`users.category_id` vs `users.role_id`); nothing keeps them in sync. A fourth, unrelated thing also called category: `feedback.category`, a fixed six-value set.

**`/tenant/users` vs `/admin/users` manage different role sets, on purpose:** Company Admin's own `/tenant/users` (mobile: the "Users" side-menu item) creates/edits/deletes `company_staff`/`student`/`teaching`/`non_teaching` only — it deliberately **cannot** create or edit a fellow `company_admin` (creating a Student here additionally requires a `category_id`, mirroring self-registration's own requirement). System Admin's cross-tenant `/admin/users` handles `company_staff`/`company_admin` only, any company. `users.service.ts` tracks this as two separate constants (`TENANT_MANAGEABLE_ROLES` vs `ADMIN_MANAGEABLE_ROLES`) — they used to be one shared list and **must not be merged back into one**.

## Order Lifecycle

```
payment_pending → order_placed → delivered
              ↘ payment_failed → (Pay Again, same order, no duplicate)
```

- Order status is finalized **only** by the server-side payment webhook, never by client-side redirect alone. The signature is HMAC-SHA256 over the **raw request bytes** (`rawBody: true` in `main.ts`) — never a re-serialized body.
- Prices are **never** client-supplied. Place-order sends only product ids + quantities; the server re-reads products, rejects deleted/sold-out items, and builds the immutable `items` snapshot itself.
- **At most one unresolved order per diner.** Placing while one is `payment_pending`/`payment_failed` returns the existing order instead of creating a second.
- Every payment attempt is its own `payment_attempts` row, exactly one `is_current = true` per order (partial unique index). Redelivered webhook events are idempotent.
- **Pickup OTP**: random 6-digit numeric, generated once at payment success; stored **plaintext** on purpose (the diner must re-read it); single-use; not returned by the API once `delivered`; never shown to Staff, who can only submit a candidate for comparison. **FCM-only, always** — never SMS.
- **Forgot-password OTP**: a separate 6-character alphanumeric code (`reset_password_otp`, SHA-256 hashed, ambiguous characters excluded). Channel follows the user's Company `is_sms`: SMS (MSG91) when `true` (falling back to FCM push on send failure), FCM push when `false`. Either way it is a **visible** message the user reads and types in — not a silent/data-only push with auto-fill.
- **Registration mobile verification** (`mobile_verifications`): same per-Company `is_sms` routing, but **no silent fallback** — a send failure is surfaced as an error. Its own DLT template (`MSG91_TEMPLATE_ID_MOBILE_VERIFICATION`, distinct from `MSG91_TEMPLATE_ID_PASSWORD_RESET`). Blocks registration only when `MOBILE_VERIFICATION_REQUIRED=true` (**default `false`**).
- `no_of_login_attempt` increments on failed login and on every forgot-password request; at `ACCOUNT_LOCK_THRESHOLD` (default 5) `status` becomes `locked`. There is **no time-based unlock** — a successful password reset is the only way back to `active`, and the only thing that resets the counter.

## Data Conventions

- Soft delete everywhere: `is_deleted` boolean, never hard-delete a record referenced elsewhere. Deactivating a user sets `status = inactive`, not a delete. FKs use `onDelete: Restrict` as a defense-in-depth guard.
- Auditability: every table carries `created_by`, `updated_by`, `created_at`, `updated_at`.
- **The `audit_logs` DB trigger covers exactly four tables: `products`, `orders`, `payment_attempts`, `feedback`** — *not* `companies`, `users`, or `deliveries`. Don't assume broader coverage. `auth_audit_logs` (login/logout/lock) and `order_audit_logs` (order + fulfilment events, including failed code attempts) capture events that aren't themselves a row changing.
- `audit_logs` is append-only at the DB level: `app_user` has **no grants at all** on it, with `UPDATE, DELETE` explicitly revoked; only the `SECURITY DEFINER` trigger inserts. **There is also no API read path** — it's a forensic artifact, not a product feature.
- Passwords are always **Argon2id** hashed — never plaintext, regardless of any legacy field named `password` in older drafts.
- Money: store as integer (paise), never float.
- List conventions: `/tenant/products`, `/tenant/categories`, `/tenant/departments` are paginated (`page`, `limit` default 10 capped at 50, `search`) returning `{items, page, limit, total}`. `/tenant/users`, `/admin/users`, `/admin/companies`, `/student/products`, `/tenant/staff/orders` return plain arrays.

## V1 Scope Boundaries

**In scope and built**: canteen pickup only (no delivery-address flow), one payment gateway (Razorpay/UPI only), OTP-based pickup verification, forgot-password via SMS/push OTP, Contact Us, Feedback submission + review, mobile-only experience.

**Out of scope for V1** (don't build unless a spec explicitly reopens it): home/hostel delivery, multiple payment gateways, loyalty/rewards/ratings, live order tracking map, in-app chat, automated refunds, diner-initiated order cancellation.

> **A web portal is being actively considered** (see BRD §12 and Architecture §13) and is no longer a settled "out of scope" item. Treat it as an open product decision, not a closed one.

## Known Gaps — do not assume these work

Documented behaviour that the code does **not** implement. Full list in BRD §11.

- **No CORS.** `main.ts` never calls `enableCors()`. Any browser client is blocked today.
- **`system_admin` has no UI.** Endpoints are complete; nothing consumes them. Onboarding a canteen means direct API calls.
- **`companies.is_open` is dead config.** Stored, System-Admin-editable, and **never read**. A "closed" canteen still accepts orders. No Company Admin toggle exists.
- **`teaching` / `non_teaching` cannot order.** They reach Profile, Contact Us and Feedback only.
- **`cancelled` order status is unreachable.** It exists in the schema and the History filter; no code path sets it.
- **Tenant identity is build-time.** `COMPANY_ID` is compiled into each branded app build — adding a tenant needs a new build, not just a DB row.
- **The shipped palette is orange** (`colors.primary = #FF6B35`), superseding `specs/013-blue-theme-visual-design` — that directory name is now misleading. Only the colour values changed; the token mechanism is intact.
- `mobile/src/theme/tokens.ts` is the single source of truth for every colour/type/spacing/radius value. No screen or component may hardcode a value it already defines. `colors.primary` is the **only** tenant-overridable token, at build time.

## Working in This Repo

- Feature work should go through the spec-kit flow (`/speckit-specify` → `/speckit-plan` → `/speckit-tasks`) so the multi-tenancy/RLS/audit rules above are re-verified per feature rather than assumed.
- `.specify/memory/constitution.md` is an unfilled template — in its absence, `docs/architecture/04-Architecture.md` + `docs/product/01-BRD.md` are the governing constraints for any plan's Constitution Check (Architecture §14's own stated mapping).
- Before assuming a technical or scope decision is "obvious," check `docs/product/02-PRD.md` §6 (questions the code has already answered) and §7 (genuinely still open), plus any feature's `spec.md` Assumptions — several plausible defaults (e.g. can a Company Admin create another Company Admin? **No.**) have already been explicitly decided and shouldn't be re-guessed differently elsewhere.
- Regenerate mobile API types after a contract change: `npm --prefix mobile run api:generate`.
- A new environment is bootstrapped with `npm --prefix api run seed:system-admin` (reads `BOOTSTRAP_ADMIN_*`, which the running app never reads).

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


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
