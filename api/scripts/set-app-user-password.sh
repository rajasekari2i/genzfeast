#!/usr/bin/env bash
# Sets (or rotates) the `app_user` database role's password from an
# environment variable — this is deliberately NOT part of any Prisma
# migration, since a migration file is version-controlled and a real,
# working credential must never be committed (coding_standard.md §10),
# even a randomly-generated one.
#
# Usage:
#   APP_USER_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-32)" \
#     ./scripts/set-app-user-password.sh
#
# Requires: SUPERUSER_DATABASE_URL (or falls back to $DATABASE_URL) pointing
# at a connection with permission to ALTER ROLE — i.e. the migration
# connection, never app_user itself.
set -euo pipefail

: "${APP_USER_PASSWORD:?Set APP_USER_PASSWORD to a freshly generated value before running this script — never hardcode it here.}"

ADMIN_URL="${SUPERUSER_DATABASE_URL:-${DATABASE_URL:?Set DATABASE_URL or SUPERUSER_DATABASE_URL}}"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "ALTER ROLE app_user WITH PASSWORD '${APP_USER_PASSWORD}';"

echo "app_user password set. Update APP_DATABASE_URL in your own .env (never committed) to match."
