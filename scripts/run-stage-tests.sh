#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# InsureDesk — Stage Test Runner
#
# Runs the full test suite (API + E2E) against the Stage environment.
# Usage:
#   chmod +x scripts/run-stage-tests.sh
#   ./scripts/run-stage-tests.sh
#
# Required env vars (set before running, or export in your shell):
#   STAGE_API_URL        — Railway backend URL
#   STAGE_BASE_URL       — Vercel frontend URL (Playwright reads this)
#   STAGE_ADMIN_EMAIL    — admin@insuredesk.com
#   STAGE_ADMIN_PASSWORD — Admin@123
#
# Optional (defaults to seeded demo credentials if not set):
#   STAGE_AGENT_EMAIL / STAGE_AGENT_PASSWORD
#   STAGE_MGR_EMAIL   / STAGE_MGR_PASSWORD
# ─────────────────────────────────────────────────────────────────

set -e   # exit on first failure

# ── Defaults ──────────────────────────────────────────────────────
STAGE_API_URL="${STAGE_API_URL:-https://insuredesk-production.up.railway.app}"
# Use branch alias URL — always points to latest develop deploy, never a stale hash-based snapshot
STAGE_BASE_URL="${STAGE_BASE_URL:-https://insuredesk-git-develop-konjetis-projects.vercel.app}"
STAGE_ADMIN_EMAIL="${STAGE_ADMIN_EMAIL:-admin@insuredesk.com}"
STAGE_ADMIN_PASSWORD="${STAGE_ADMIN_PASSWORD:-Admin@123}"
STAGE_AGENT_EMAIL="${STAGE_AGENT_EMAIL:-alex.johnson@insuredesk.com}"
STAGE_AGENT_PASSWORD="${STAGE_AGENT_PASSWORD:-Agent@123}"
STAGE_MGR_EMAIL="${STAGE_MGR_EMAIL:-jennifer.w@insuredesk.com}"
STAGE_MGR_PASSWORD="${STAGE_MGR_PASSWORD:-Manager@123}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  InsureDesk Stage Test Suite"
echo "  API URL  : $STAGE_API_URL"
echo "  Front URL: $STAGE_BASE_URL"
echo "  Admin   : $STAGE_ADMIN_EMAIL"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── Step 1: Health check ──────────────────────────────────────────
echo "▶ Step 1/3 — Health check..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$STAGE_API_URL/health" 2>/dev/null || echo "000")
if [ "$STATUS" != "200" ]; then
  echo ""
  echo "❌ Stage API is not responding (HTTP $STATUS at $STAGE_API_URL/health)"
  echo "   Make sure Stage is deployed and running before running tests."
  exit 1
fi
echo "   ✅ Stage API is up (HTTP 200)"

# ── Step 2: Backend API tests ─────────────────────────────────────
echo ""
echo "▶ Step 2/3 — Backend Stage API tests..."
cd "$ROOT/backend"
STAGE_API_URL="$STAGE_API_URL" \
STAGE_ADMIN_EMAIL="$STAGE_ADMIN_EMAIL" \
STAGE_ADMIN_PASSWORD="$STAGE_ADMIN_PASSWORD" \
STAGE_AGENT_EMAIL="$STAGE_AGENT_EMAIL" \
STAGE_AGENT_PASSWORD="$STAGE_AGENT_PASSWORD" \
STAGE_MGR_EMAIL="$STAGE_MGR_EMAIL" \
STAGE_MGR_PASSWORD="$STAGE_MGR_PASSWORD" \
  npx jest --config jest.config.stage.js --forceExit

echo ""
echo "   ✅ Backend Stage API tests passed"

# ── Step 3: Playwright E2E tests ──────────────────────────────────
echo ""
echo "▶ Step 3/3 — Playwright E2E tests against Stage..."
cd "$ROOT/frontend"

if ! command -v npx &>/dev/null; then
  echo "   ⚠️  npx not found — skipping E2E tests"
else
  STAGE_BASE_URL="$STAGE_BASE_URL" \
    npx playwright test \
      --config playwright.config.stage.js \
      --project=chromium-stage
  echo ""
  echo "   ✅ E2E Stage tests passed"
  echo "   📊 Report: frontend/playwright-report-stage/index.html"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅  All Stage tests passed — safe to promote to Production"
echo "═══════════════════════════════════════════════════════════"
echo ""
