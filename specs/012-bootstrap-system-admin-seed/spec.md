# Feature Specification: Bootstrap Default System Admin Account

**Feature Branch**: `012-bootstrap-system-admin-seed`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "GenzFeast is a multi-tenant (multi-company) mobile food ordering platform that connects college canteens (\"companies\"/tenants) with students on their campus. Each canteen operates as an independent tenant with its own staff, products, and orders, while a central System Admin governs onboarding and platform-wide oversight. Analyse the BRD, PRD, Architecture, and UI Design docs and spec a database migration that creates a default Super Admin account with a given identity (name, username, password, email, etc.)."

**Scope note**: This closes Gap #5 from the prior gap analysis — `001-company-role-user-setup`'s own `data-model.md` flagged provisioning the platform's very first System Admin account as an "Open Follow-Up" that no subsequent feature ever picked up. Two deliberate deviations from the request's literal example values are documented in Assumptions, for reasons explained there: (1) the specific credential values supplied are treated as **local/example seed values**, not a single fixed identity to be identically deployed to every environment including production; (2) no literal password value is written into this spec or any migration file — only the mechanism for supplying and hashing one.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A Freshly Deployed Environment Has a Working System Admin Account (Priority: P1)

When the platform is deployed to a brand-new environment, exactly one System Admin account already exists and can log in immediately — with no manual database step, and no chicken-and-egg problem where onboarding the first canteen requires an admin who doesn't yet exist.

**Why this priority**: This is the entire point of the feature — without it, a new environment is unusable until someone manually inserts a row, which is exactly the gap this closes.

**Independent Test**: Can be fully tested by deploying/migrating a fresh environment and confirming a System Admin account exists and can successfully log in via the platform's existing login flow (`002-registration-login-jwt-auth`), without any manual data entry.

**Acceptance Scenarios**:

1. **Given** a brand-new environment with no existing users, **When** the database migration runs, **Then** exactly one System Admin account exists afterward.
2. **Given** the seeded System Admin account, **When** it logs in using its configured credentials, **Then** login succeeds and it can immediately begin onboarding companies, exactly as any other System Admin account could.
3. **Given** an environment where a System Admin account already exists (seeded previously, or created some other way), **When** the migration runs again, **Then** no additional System Admin account is created — the migration has no effect the second time.

---

### User Story 2 - The Bootstrap Credential Can Be Rotated Immediately (Priority: P2)

Whoever first logs into the seeded account can change its password right away, the same way any user would, so the bootstrap credential doesn't need to remain in use indefinitely.

**Why this priority**: A seeded account's initial credential is inherently more exposed (known to whoever configured the environment) than a normally self-chosen one — being able to rotate it immediately, using capability the platform already has, closes that exposure window quickly. It's a safeguard on top of Story 1, not a separate blocking capability.

**Independent Test**: Can be fully tested by logging into the seeded account and successfully changing its password via the platform's existing change-password capability (`007-user-profile-management`), with no special-casing required for this being the bootstrap account.

**Acceptance Scenarios**:

1. **Given** the seeded System Admin account, **When** it uses the platform's existing change-password action, **Then** its password is updated exactly as it would be for any other account — no special restriction prevents this.

---

### Edge Cases

- What happens if the migration is run on an environment that already has a System Admin account, whether seeded previously or created another way? (No new account is created — the migration is a no-op in that case; see User Story 1, Scenario 3.)
- What happens if the environment-specific values needed to seed the account (its name, username, email, and initial password) are not supplied at the time the migration runs? (The migration MUST fail clearly rather than silently falling back to a predictable or blank credential — this feature does not define a fallback identity.)
- What happens to the seeded account's identity fields (Category, Department) given they don't apply to the System Admin role? (Left unset — see FR-008; this is not an oversight, it mirrors how every other System Admin account is already defined by `001-company-role-user-setup`.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A database migration/seed process MUST create exactly one System Admin account if none already exists in that environment.
- **FR-002**: The migration/seed process MUST be safely re-runnable — running it again on an environment that already has a System Admin account MUST NOT create a duplicate and MUST NOT error out destructively.
- **FR-003**: The seeded account MUST NOT belong to any single Company — consistent with the System Admin role's existing platform-wide, not Company-scoped, definition (`001-company-role-user-setup`).
- **FR-004**: The seeded account's password MUST be stored only in its securely hashed form, using the platform's existing password-hashing mechanism (`002-registration-login-jwt-auth`) — never in plain text, and never as a literal value written into any migration or configuration file that is committed to source control.
- **FR-005**: The seeded account's identifying details (name, username, email) and its initial password MUST be supplied via environment-specific configuration at the moment the migration/seed process runs, not hardcoded as a single fixed identity shared across every environment.
- **FR-006**: The seeded account MUST start in an active status, with its consecutive-failed-login counter at zero, ready to log in immediately.
- **FR-007**: The seeded account MUST be assigned exactly one role: the platform-wide System Admin role, consistent with `001-company-role-user-setup`'s role model.
- **FR-008**: The seeded account MUST NOT be assigned a Category or a Department — those concepts apply only to Company-scoped roles (`001-company-role-user-setup`), and the System Admin role is not scoped to any Company.
- **FR-009**: The seeded account's password MUST be changeable through the platform's existing change-password capability (`007-user-profile-management`) the same as any other account, with no special restriction preventing it.

### Key Entities

- **Bootstrap System Admin Account** *(not a new entity — a specific instance of the existing User entity from `001-company-role-user-setup`)*: The one System Admin account guaranteed to exist immediately after a fresh environment's database migration runs, so the platform is usable from the moment it's deployed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A freshly deployed environment has exactly one working System Admin account immediately after migration, with zero manual database intervention required.
- **SC-002**: Running the migration/seed process more than once on the same environment never results in more than one System Admin account existing as a result of it.
- **SC-003**: The seeded account's password is never recoverable in plain text from the database or from any file committed to source control.
- **SC-004**: A System Admin can log in with the seeded credentials and immediately begin onboarding companies, with no additional setup step required beyond the migration itself.

## Assumptions

- **Supplied values are per-environment configuration, not one fixed identity**: The specific name, username, email, and password given in the original request are treated as an example/local-development seed, not a single credential to be identically deployed to every environment including production. Seeding the exact same known username and password across dev, staging, and production (per the environments Architecture §9 already defines) would itself be a security weakness — each environment supplies its own values at seed time (FR-005).
- **No literal password value appears in this spec or in any committed migration file**: Only its securely hashed form is ever persisted (FR-004), and only the *mechanism* for supplying and hashing an initial password is specified here — never a specific plaintext value, consistent with the platform's existing password-handling standard (`002-registration-login-jwt-auth`).
- **Category/Department are inapplicable, not omitted by mistake**: The original request's "category_id=System Admin" is treated as descriptive shorthand for "this account holds the System Admin role," not a literal reference to a Category record — `001-company-role-user-setup`'s Category entity is inherently scoped to one Company (used for Student/Teaching/Non-Teaching affiliation within that Company), and the System Admin role has no Company to scope such a value to. No Category or Department is set (FR-008).
- **Scope is exactly the first/default account, not ongoing System Admin creation**: This feature covers only guaranteeing one System Admin account exists on a fresh environment. Whether an existing System Admin can create *additional* System Admin accounts through the app is a separate, currently unaddressed capability (not built by `001` or any other existing spec) and is out of scope here.
