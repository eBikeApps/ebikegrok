#!/usr/bin/env bash
# Render build — must exit 0 even if db push cannot get a pooler connection.
set -euo pipefail

echo "[render-build] Installing dependencies..."
bun install

echo "[render-build] Generating Prisma client..."
bunx prisma generate

echo "[render-build] Syncing database schema (non-fatal)..."
# Session-mode Supabase pooler often returns EMAXCONNSESSION during deploys.
# Never fail the build on that — schema is usually already applied.
set +e
bunx prisma db push --accept-data-loss --skip-generate
echo "[render-build] prisma db push exit code: $?"
set -e

echo "[render-build] Done."
