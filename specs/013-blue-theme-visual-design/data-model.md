# Data Model: Blue Visual Design System (Zomato-Style Food App UI)

Neither entity below is a database table — both are `mobile/`-side TypeScript structures (no migration, no API). See `research.md` §3 for why per-tenant branding stays a build-time artifact rather than a `companies` table column.

## 1. Design Token Set

The platform-wide, fixed set of values every screen/component consumes. Defined once in `mobile/src/theme/tokens.ts`; never overridden per tenant.

| Field | Type | Description |
|---|---|---|
| `colors.primary` | hex string | Primary CTA / active-state color (default `#1565C0`) |
| `colors.primaryVariant` | hex string | Pressed/active/header color (default `#0D47A1`) |
| `colors.accent` | hex string | Secondary highlight / selected-chip color (default `#29B6F6`) |
| `colors.surface` | hex string | Card/sheet background (default `#FFFFFF`) |
| `colors.background` | hex string | Screen background (default `#F5F8FC`) |
| `colors.textPrimary` | hex string | Heading/body text color (default `#12202E`) |
| `colors.textSecondary` | hex string | Caption/secondary text color (default `#5B6B7A`) |
| `statusColors` | map of order status → `{ color: hex string, label: string }` | One entry per `payment_pending` \| `order_placed` \| `payment_failed` \| `delivered` (spec FR-002/FR-003) |
| `typography` | named scale (`h1`, `h2`, `body`, `bodyBold`, `price`, `caption`, `button`) → `{ fontSize: number, fontWeight: string, lineHeight: number }` | One fixed scale used everywhere (FR-004) |
| `spacing` | named scale (`xs`, `sm`, `md`, `lg`, `xl`) → number (dp) | Consistent gutters/padding across all three surfaces |
| `radius` | named scale (`sm`, `md`, `lg`, `pill`) → number (dp) | Card corner radius, chip/button pill radius |

**Validation rules**:
- Every `colors.*` and `statusColors.*.color` value MUST be a valid 6-digit hex string.
- `statusColors` MUST contain exactly the 4 order-lifecycle statuses defined in `CLAUDE.md`'s Order Lifecycle — no more, no fewer (adding a 5th status is a spec change, not a token change).
- No component may reference a color or font size not present in this token set (spec SC-003).

## 2. Tenant Brand Theme

A per-Company, build-time-only override of a small subset of the Design Token Set, applied exclusively to that company's Student App build (spec FR-011). References the `Company` entity from `specs/001-company-role-user-setup/data-model.md` by `companyId`, but is **not** stored in that table — it is a standalone build input (see `contracts/tenant-brand-config.schema.json`).

| Field | Type | Description |
|---|---|---|
| `companyId` | UUID string | The company this brand override belongs to (matches `companies.id` from spec 001, for traceability only — not a foreign key, since this isn't a DB row) |
| `accentColor` | hex string | Replaces `colors.primary` for this tenant's Student App build only |
| `logoAssetPath` | string (build-relative file path) | Replaces the default app icon/splash logo |
| `appDisplayName` | string | Replaces the default app display name |
| `contrastCheckPassed` | boolean (computed, not stored) | Result of applying `contrastCheck.ts` to `accentColor` against `colors.background`/`colors.surface`/`colors.textPrimary`; if `false`, the build uses the Design Token Set's default `colors.primary` instead (spec FR-012) |

**Validation rules / resolution flow** (executed once, at build time, by `resolveBrandTheme.ts`):

1. Start from the Design Token Set's defaults.
2. If a `Tenant Brand Theme` config file is supplied for this build, validate its shape against `contracts/tenant-brand-config.schema.json`.
3. Run `contrastCheck.ts` on the supplied `accentColor` two ways, matching how `colors.primary` is actually used (`contracts/design-tokens.md`): (a) as a foreground — against `colors.background` and `colors.surface`, for its use as a link/active-tab/icon color directly on the screen; and (b) as a button fill — checking a white (`#FFFFFF`) label against `accentColor` as the background, for its use in `PrimaryButton`. Both must independently clear WCAG 2.1 AA (4.5:1).
4. If the check passes, override `colors.primary` (and apply `logoAssetPath`/`appDisplayName`) for this build only. If it fails, keep the default `colors.primary`, apply `logoAssetPath`/`appDisplayName` unchanged (those aren't contrast-gated), and emit a build-time warning naming the rejected color.
5. `statusColors`, `typography`, `spacing`, and `radius` are never touched by this flow (FR-011) — only `colors.primary`, the logo, and the display name are overridable.

There are no state transitions beyond this one-time, per-build resolution — a running app instance never re-resolves its theme.
