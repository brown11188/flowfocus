#!/bin/sh
set -e

echo "=== FlowFocus Starting ==="

# Load .env.production into environment if it exists and is readable
if [ -f "/app/.env.production" ] && [ -r "/app/.env.production" ]; then
  echo "Loading env from .env.production..."
  set -a
  . /app/.env.production
  set +a
else
  echo "Note: .env.production not readable, using container environment variables"
fi

# ── Secret normalisation ────────────────────────────────────────────────────
# NextAuth v5 requires AUTH_SECRET. The platform may provide it under any of
# these names; promote whichever one is present.
if [ -z "$AUTH_SECRET" ]; then
  if [ -n "$NEXTAUTH_SECRET" ]; then
    export AUTH_SECRET="$NEXTAUTH_SECRET"
    echo "Mapped NEXTAUTH_SECRET -> AUTH_SECRET"
  elif [ -n "$NEXT_AUTH_SECRET" ]; then
    export AUTH_SECRET="$NEXT_AUTH_SECRET"
    export NEXTAUTH_SECRET="$NEXT_AUTH_SECRET"
    echo "Mapped NEXT_AUTH_SECRET -> AUTH_SECRET / NEXTAUTH_SECRET"
  else
    echo "WARNING: No auth secret found (AUTH_SECRET / NEXTAUTH_SECRET / NEXT_AUTH_SECRET)"
  fi
fi

# ── Canonical URL (AUTH_URL) ─────────────────────────────────────────────────
# AUTH_URL is injected directly by the deployment script as:
#   https://buildwith.agentcrew.dev/apps/<id>/api/auth
#
# This is consumed by @auth/core (NextAuth v5) to build OAuth callback URLs
# and is the single source of truth. Do NOT re-derive it from NEXTAUTH_URL.
#
# Plan B (deployment script) ensures AUTH_URL is always injected correctly.
if [ -z "$AUTH_URL" ]; then
  echo "WARNING: AUTH_URL is not set — NextAuth callbacks will not work!"
  echo "         Expected format: https://your-domain/apps/<project-id>/api/auth"
else
  echo "AUTH_URL: $AUTH_URL"
fi
# Keep NEXTAUTH_URL as-is (injected by deploy script as app root URL).
# NextAuth v5 does not use NEXTAUTH_URL directly; AUTH_URL takes precedence.
echo "NEXTAUTH_URL: ${NEXTAUTH_URL:-<not set>}"

echo "Initializing database..."
DB_PATH=$(echo "$DATABASE_URL" | sed 's|^file:||')
DB_DIR=$(dirname "$DB_PATH")
mkdir -p "$DB_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "No database found — creating empty DB file for migration container..."
  touch "$DB_PATH"
  # File is owned by nextjs (current user) — no broad chmod needed
  echo "Empty DB created at $DB_PATH"
else
  echo "Database exists at $DB_PATH"
fi

echo "Starting Next.js server..."
exec node server.js
