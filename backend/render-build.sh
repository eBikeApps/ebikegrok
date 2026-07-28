#!/usr/bin/env bash
set -euo pipefail

echo "[render-build] Installing dependencies..."
bun install --frozen-lockfile 2>/dev/null || bun install

# Generate client first — does not need a live DB connection
echo "[render-build] Generating Prisma client..."
bunx prisma generate

# Schema sync is best-effort: Supabase session pooler often hits max clients during deploy.
# A failed push must not block the whole deploy when schema is already up to date.
echo "[render-build] Syncing database schema (best effort)..."
set +e
# Prefer transaction/pooler URL when available; fall back to DATABASE_URL
PUSH_URL="${DATABASE_URL:-}"
if [[ -n "${DATABASE_URL:-}" && "${DATABASE_URL}" == *":5432/"* && "${DATABASE_URL}" == *"pooler.supabase.com"* ]]; then
  # Session mode (5432) is limited; try transaction port 6543 for migrations
  PUSH_URL="${DATABASE_URL//:5432\//:6543/}"
  if [[ "$PUSH_URL" != *"pgbouncer=true"* ]]; then
    if [[ "$PUSH_URL" == *"?"* ]]; then
      PUSH_URL="${PUSH_URL}&pgbouncer=true"
    else
      PUSH_URL="${PUSH_URL}?pgbouncer=true"
    fi
  fi
  echo "[render-build] Using pooler port 6543 for db push"
fi

if [[ -n "$PUSH_URL" ]]; then
  DATABASE_URL="$PUSH_URL" bunx prisma db push --accept-data-loss --skip-generate
else
  bunx prisma db push --accept-data-loss --skip-generate
fi
PUSH_EXIT=$?
set -e

if [[ $PUSH_EXIT -ne 0 ]]; then
  echo "[render-build] WARNING: prisma db push exited $PUSH_EXIT — continuing deploy (generate already ok)"
else
  echo "[render-build] prisma db push succeeded"
fi

echo "[render-build] Done."
