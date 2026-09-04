# Architecture Document
## GenzFeast — Multi-Tenant Food Ordering Platform

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Mobile client | React Native (single codebase, multiple tenant build flavors) |
| Backend API | Node.js (Express/NestJS) |
| Database | Firebase Cloud Firestore |
| File storage | Firebase Storage (product images) |
| Auth | Firebase Authentication (custom token/phone or username+password via backend-issued custom tokens) + custom claims for `role` and `company_id` |
| Push notifications | Firebase Cloud Messaging (OTP delivery, order status updates) |
| Payments | Single payment gateway integration (e.g., Razorpay/Stripe — TBD), server-verified via webhook |
| Hosting (API) | Cloud Run / Firebase Functions / any Node-compatible host |

## 2. Database Choice: Firestore vs Realtime Database

The source PRD says "firebase database" without specifying which. **Recommendation: Cloud Firestore**, because:
- Structured, document-based data (companies, users, products, orders) maps naturally to Firestore collections/documents.
- Firestore supports richer queries (compound `where` clauses) needed for tenant-scoped filtering (`company_id` + `status`, etc.).
- Realtime Database is better suited to raw real-time sync of flat trees (e.g., live cursors), which isn't the primary need here.
- Firestore security rules integrate cleanly with Firebase Auth custom claims for the multi-tenant isolation required in §5.

*(This is an assumption — confirm before implementation, since it affects every downstream data-access pattern.)*

## 3. Multi-Tenancy Model: "Separate App per Company"

The PRD states each company has "a separate mobile application" — interpreted two ways, with a recommendation:

| Option | Description | Trade-off |
|---|---|---|
| **A — Recommended: Single codebase, multiple build flavors** | One React Native codebase; tenant branding (name, logo, colors, `company_id`) baked in at build time via `.env`/flavor config; produces N separate app binaries/store listings. | Low maintenance, consistent features across tenants, faster new-tenant onboarding once the "template" build pipeline exists. |
| **B — Fully separate codebases per tenant** | Each tenant's app is forked and maintained independently. | High maintenance cost, feature drift, contradicts BRD objective O5 (fast onboarding). **Not recommended.** |

The **backend and database remain single, shared, and multi-tenant** in both options — tenancy is enforced at the data layer (`company_id` on every record + Firestore security rules + backend middleware), not by running separate backend instances.

A **separate System Admin surface** (web app or an "admin mode" screen set) is used by the System Admin to create companies and their first Company Admin — this is not tenant-branded and is internal-only.

## 4. High-Level Component Diagram

```
                        ┌────────────────────────┐
                        │   System Admin Portal   │  (internal, web or app)
                        └───────────┬─────────────┘
                                    │ REST/HTTPS (admin APIs)
                                    ▼
 ┌───────────────┐        ┌─────────────────────┐        ┌────────────────────┐
 │ Tenant Admin & │        │                     │        │                    │
 │ Staff App      │◄──────►│   Node.js API       │◄──────►│  Cloud Firestore   │
 │ (React Native) │  HTTPS │   (Express/NestJS)  │        │  (multi-tenant DB) │
 └───────────────┘        │                     │        └────────────────────┘
                          │  - Auth middleware   │
 ┌───────────────┐        │  - Tenant scoping    │        ┌────────────────────┐
 │ Student App    │◄──────►│  - Order/Payment     │◄──────►│  Firebase Storage  │
 │ (React Native, │  HTTPS │    orchestration     │        │  (product images)  │
 │  per-tenant    │        │  - OTP generation    │        └────────────────────┘
 │  build)        │        └──────────┬───────────┘
 └───────────────┘                    │
                                       ├──────────────► Firebase Cloud Messaging (OTP / status push)
                                       │
                                       └──────────────► Payment Gateway (redirect + webhook callback)
```

## 5. Multi-Tenant Isolation Strategy

1. **Auth custom claims**: on login, the backend issues a Firebase custom token embedding `{ role, company_id, user_id }`.
2. **Backend middleware**: every API request resolves `company_id` from the verified token (never from client-supplied input) and injects it into every DB query/filter.
3. **Firestore security rules**: defense-in-depth — even if a client calls Firestore directly, rules re-check `resource.data.company_id == request.auth.token.company_id`.
4. **System Admin bypass**: a distinct `system_admin` claim (no `company_id`) is allowed cross-tenant read/write only on `companies` and for provisioning the first Company Admin.

## 6. Order & Payment Sequence

```
Student App        Node API              Payment Gateway        Firestore
    │  place order     │                        │                   │
    ├──────────────────►                        │                   │
    │                  ├── create order (payment_pending) ─────────►│
    │                  ├── init payment session ─►                  │
    │  ◄───────────────┤   redirect URL          │                  │
    │  redirect to PG  │                        │                   │
    ├──────────────────────────────────────────►│                   │
    │                  │      webhook (server-to-server, success/failure)
    │                  │◄───────────────────────┤                   │
    │                  ├── verify signature ─────                   │
    │                  ├── update order status + generate OTP ──────►│
    │  poll/callback    │                        │                   │
    │◄─────────────────┤ order status + OTP     │                   │
```

> **Critical design rule:** order status is only ever finalized by the **server-side webhook**, never purely by the client-side redirect, so that a closed app / dropped connection cannot leave an order incorrectly stuck or falsely marked successful.

## 7. Notification Flow (OTP)

- **Password reset OTP** (alphanumeric): generated by backend → stored in `users.reset_password_otp` (+ expiry) → sent via FCM push → also shown as a fallback if the user reopens the "forgot password" screen before it expires (implementation detail for the Modules doc).
- **Order OTP** (numeric): generated on payment success → stored in `orders.otp` → pushed via FCM **and** always visible on the order confirmation screen (per PRD FR-8.4), since pickup at a physical counter should not depend on a notification having been received.

## 8. Environments & Deployment

| Environment | Firebase Project | Purpose |
|---|---|---|
| `dev` | `genzfeast-dev` | Active development |
| `staging` | `genzfeast-staging` | Pre-release QA, tenant onboarding rehearsal |
| `prod` | `genzfeast-prod` | Live tenants |

- Node.js API deployed as containerized service (Cloud Run) or Firebase Cloud Functions, environment-parameterized (no hardcoded secrets — use Secret Manager).
- Mobile builds: one CI pipeline per environment × per tenant flavor, parameterized by `TENANT_ID`/`company_id` and branding assets.

## 9. Non-Functional / Cross-Cutting Concerns

| Concern | Approach |
|---|---|
| Security | Password hashing (bcrypt), OTP expiry, server-only OTP writes, Firestore rules, HTTPS everywhere |
| Scalability | Stateless Node API instances behind a load balancer/Cloud Run autoscaling; Firestore scales horizontally by design |
| Observability | Structured logs per `company_id` + `order_id`; alert on webhook failures / payment mismatches |
| Testing | Contract tests for payment webhook handling (success/failure/duplicate delivery) |
| Spec-driven build | See §10 |

## 10. Note on Spec-Driven Development (Claude Code / spec-kit)

This document set is structured so each functional area has stable identifiers (`FR-x`, collection names, module names) that can be referenced directly in a `spec-kit`-style workflow:

1. **Constitution** → this Architecture doc + BRD.
2. **Specify** → PRD (`FR-1` … `FR-9`) + Data Model.
3. **Plan** → Module documents (05) map 1:1 to implementation phases/agents.
4. **Tasks** → break each module doc's "Screens" and "APIs" sections into implementable tasks.

This lets a multi-agent ("metaswarm"-style) workflow assign one module document per agent/session while sharing the single Data Model and Architecture doc as the shared source of truth, minimizing cross-agent contradiction.
