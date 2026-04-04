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
if [ -n "$NEXTAUTH_URL" ]; then
  APP_ROOT=$(echo "$NEXTAUTH_URL" | sed 's|/*$||')
  export AUTH_URL="${APP_ROOT}/api/auth"
  export NEXTAUTH_URL="$APP_ROOT"
fi

if [ -z "$AUTH_URL" ]; then
  echo "WARNING: AUTH_URL is not set — NextAuth callbacks will not work!"
else
  echo "AUTH_URL: $AUTH_URL"
fi
echo "NEXTAUTH_URL: ${NEXTAUTH_URL:-<not set>}"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

echo "Database URL detected (PostgreSQL/Neon expected)."
echo "Starting Next.js server..."
exec node server.js
