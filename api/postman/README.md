# Validating the API in Postman

This covers `specs/001-company-role-user-setup`'s System Admin Company endpoints (Work Unit 2). `specs/002` (login/JWT issuance) doesn't exist yet, so there is no `/auth/login` to call — a dev-only script mints a token with the same claim shape instead.

## 1. Start the server

```bash
cd api
npm install     # first time only
npx prisma generate
npm run start:dev
```

Leave it running (`Ctrl+C` to stop it). It listens on `http://localhost:3000` by default (`PORT` in `.env`).

## 2. Get an access token

Login isn't built yet, so mint one directly with the same signing secret the server uses:

```bash
cd api
npm run mint-dev-jwt -- --role system_admin
```

This prints a JWT to stdout, signed with your `.env`'s `JWT_SECRET`, with `role: system_admin`, expiring in 12h. Copy it.

To act as a different role instead (e.g. to see a `403`), pass `--role company_admin --company-id <uuid>`.

**This script is a temporary bridge, not a real login** — it exists only because `specs/002` hasn't been implemented yet. Once it is, use its `/auth/login` endpoint instead and delete this workaround.

## 3. Import the collection

In Postman: **Import** → select `postman/GenzFeast-API.postman_collection.json`.

Then set the collection's `accessToken` variable to the token from step 2 (collection → **Variables** tab, or click the collection → "..." → Edit → Variables).

## 4. Run the requests

- **List Companies** — `GET /admin/companies`
- **Create Company** — `POST /admin/companies`. On a `201`, its Tests script automatically saves the new company's `id` into the collection's `companyId` variable.
- **Update Company (toggle open/closed)** — `PATCH /admin/companies/{{companyId}}`
- **Create Company Admin** — `POST /admin/companies/{{companyId}}/admins` — the first Company Admin account for that company (password is a temporary one; there's no login endpoint yet to use it with).

Run **Create Company** first so `{{companyId}}` is populated before the other two.

## What you should see

- No token / wrong role → `401`/`403`
- A missing required field, or an unrecognized extra field → `400`
- A successful `POST /admin/companies` → the company's row, and (verified by the automated contract tests, not visible in the response) its 3 tenant roles (`company_admin`/`staff`/`student`) auto-seeded by the DB trigger
- Creating the same username twice under one company → `409`
