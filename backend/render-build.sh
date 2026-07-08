#!/usr/bin/env bash
set -euo pipefail
echo "[render-build] Installing dependencies..."
bun install
echo "[render-build] Syncing database schema..."
bunx prisma db push --accept-data-loss
echo "[render-build] Generating Prisma client..."
bunx prisma generate
echo "[render-build] Done."