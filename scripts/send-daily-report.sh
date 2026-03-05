#!/usr/bin/env bash
# =============================================================================
# InsureDesk — Daily Stage Test Report (runs tests + emails HTML via Gmail)
# =============================================================================
# Setup (one time):
#   1. Enable 2FA on your Google account: myaccount.google.com/security
#   2. Generate an App Password: myaccount.google.com/apppasswords
#      → App name: "InsureDesk CI"  → Copy the 16-char password
#   3. Add to ~/.zshrc:
#        export GMAIL_USER="suneethakonjeti@gmail.com"
#        export GMAIL_APP_PASS="xxxx xxxx xxxx xxxx"
#   4. Install nodemailer once:
#        cd /path/to/insuredesk && npm install nodemailer --save-dev
#   5. chmod +x scripts/send-daily-report.sh
#   6. Schedule: crontab -e  →  0 8 * * * cd /path/to/insuredesk && bash scripts/send-daily-report.sh
# =============================================================================
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_DIR="$PROJECT_DIR/reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATE_LABEL=$(date +"%A, %B %-d, %Y")

JEST_JSON="$REPORT_DIR/jest-results-$TIMESTAMP.json"
PW_JSON="$REPORT_DIR/pw-results-$TIMESTAMP.json"
COVERAGE_JSON="$PROJECT_DIR/backend/coverage/coverage-summary.json"
HTML_REPORT="$REPORT_DIR/stage-report-$TIMESTAMP.html"
LOG_FILE="$REPORT_DIR/daily-run-$TIMESTAMP.log"

RECIPIENT_EMAIL="${RECIPIENT_EMAIL:-suneethakonjeti@gmail.com}"
GMAIL_USER="${GMAIL_USER:-}"
GMAIL_APP_PASS="${GMAIL_APP_PASS:-}"

STAGE_API_URL="${STAGE_API_URL:-https://insuredesk-production.up.railway.app}"
STAGE_BASE_URL="${STAGE_BASE_URL:-https://insuredesk-5ssw082eq-konjetis-projects.vercel.app}"

# ── Validate dependencies ─────────────────────────────────────────────────────
mkdir -p "$REPORT_DIR"
echo "=== InsureDesk Daily Stage Report — $DATE_LABEL ===" | tee "$LOG_FILE"

if [[ -z "$GMAIL_USER" || -z "$GMAIL_APP_PASS" ]]; then
  echo "ERROR: GMAIL_USER and GMAIL_APP_PASS are not set." | tee -a "$LOG_FILE"
  echo "  Add to ~/.zshrc:" | tee -a "$LOG_FILE"
  echo "    export GMAIL_USER=\"suneethakonjeti@gmail.com\"" | tee -a "$LOG_FILE"
  echo "    export GMAIL_APP_PASS=\"xxxx xxxx xxxx xxxx\"" | tee -a "$LOG_FILE"
  echo "  Then run: source ~/.zshrc" | tee -a "$LOG_FILE"
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "ERROR: node is not installed or not in PATH." | tee -a "$LOG_FILE"
  exit 1
fi

# Check nodemailer is installed
if ! node -e "require('nodemailer')" &>/dev/null; then
  echo "ERROR: nodemailer is not installed." | tee -a "$LOG_FILE"
  echo "  Run: cd $PROJECT_DIR && npm install nodemailer --save-dev" | tee -a "$LOG_FILE"
  exit 1
fi

# ── Run Unit tests + Coverage ─────────────────────────────────────────────────
echo "" | tee -a "$LOG_FILE"
echo "▶ Running Unit tests with coverage (Jest)..." | tee -a "$LOG_FILE"
UNIT_EXIT=0
cd "$PROJECT_DIR/backend"
JWT_SECRET="insuredesk-daily-report-secret" \
  ./node_modules/.bin/jest --config jest.config.js \
    --testPathIgnorePatterns="tests/stage" \
    --coverage --coverageReporters=json-summary \
    --forceExit --silent 2>>"$LOG_FILE" || UNIT_EXIT=$?
cd "$PROJECT_DIR"

if [[ $UNIT_EXIT -eq 0 ]]; then
  echo "  ✅ Unit tests: all passed (coverage written to backend/coverage/)" | tee -a "$LOG_FILE"
else
  echo "  ⚠️  Unit tests: some issues (exit $UNIT_EXIT) — coverage may be partial" | tee -a "$LOG_FILE"
fi

# ── Run Jest API tests ────────────────────────────────────────────────────────
echo "" | tee -a "$LOG_FILE"
echo "▶ Running Backend API tests (Jest)..." | tee -a "$LOG_FILE"
JEST_EXIT=0
cd "$PROJECT_DIR/backend"
STAGE_API_URL="$STAGE_API_URL" \
  ./node_modules/.bin/jest --testPathPattern "stage" \
    --no-coverage \
    --json --outputFile "$JEST_JSON" \
    --forceExit 2>>"$LOG_FILE" | tee -a "$LOG_FILE" || JEST_EXIT=$?
cd "$PROJECT_DIR"

if [[ $JEST_EXIT -eq 0 ]]; then
  echo "  ✅ Jest: all tests passed" | tee -a "$LOG_FILE"
else
  echo "  ❌ Jest: some tests failed (exit $JEST_EXIT)" | tee -a "$LOG_FILE"
fi

# ── Run Playwright E2E tests ──────────────────────────────────────────────────
echo "" | tee -a "$LOG_FILE"
echo "▶ Running E2E tests (Playwright)..." | tee -a "$LOG_FILE"
PW_EXIT=0
cd "$PROJECT_DIR/frontend"
npx playwright test \
  --config "$PROJECT_DIR/frontend/playwright.config.stage.js" \
  --reporter=json 2>>"$LOG_FILE" \
  > "$PW_JSON" || PW_EXIT=$?
cd "$PROJECT_DIR"

if [[ $PW_EXIT -eq 0 ]]; then
  echo "  ✅ Playwright: all tests passed" | tee -a "$LOG_FILE"
else
  echo "  ❌ Playwright: some tests failed (exit $PW_EXIT)" | tee -a "$LOG_FILE"
fi

# ── Generate HTML report ──────────────────────────────────────────────────────
echo "" | tee -a "$LOG_FILE"
echo "▶ Generating HTML report..." | tee -a "$LOG_FILE"
node "$SCRIPT_DIR/generate-html-report.js" \
  --jest "$JEST_JSON" \
  --playwright "$PW_JSON" \
  --coverage "$COVERAGE_JSON" \
  --out "$HTML_REPORT" 2>>"$LOG_FILE"
echo "  Report: $HTML_REPORT" | tee -a "$LOG_FILE"

# ── Determine subject line ────────────────────────────────────────────────────
OVERALL_STATUS="✅ ALL PASSED"
if [[ $JEST_EXIT -ne 0 ]] || [[ $PW_EXIT -ne 0 ]]; then
  OVERALL_STATUS="❌ FAILURES DETECTED"
fi
SUBJECT="InsureDesk Stage Report — $OVERALL_STATUS — $DATE_LABEL"

# ── Send via Gmail (Nodemailer) ───────────────────────────────────────────────
echo "" | tee -a "$LOG_FILE"
echo "▶ Sending email to $RECIPIENT_EMAIL via Gmail..." | tee -a "$LOG_FILE"

GMAIL_USER="$GMAIL_USER" \
GMAIL_APP_PASS="$GMAIL_APP_PASS" \
RECIPIENT_EMAIL="$RECIPIENT_EMAIL" \
  node "$SCRIPT_DIR/send-email-gmail.js" \
    --to "$RECIPIENT_EMAIL" \
    --subject "$SUBJECT" \
    --html "$HTML_REPORT" 2>>"$LOG_FILE" | tee -a "$LOG_FILE" || {
  echo "  ❌ Email failed — check $LOG_FILE for details" | tee -a "$LOG_FILE"
}

# ── Cleanup old reports (keep last 30 days) ───────────────────────────────────
echo "" | tee -a "$LOG_FILE"
find "$REPORT_DIR" -name "*.json" -mtime +30 -delete 2>/dev/null || true
find "$REPORT_DIR" -name "*.html" -mtime +30 -delete 2>/dev/null || true
find "$REPORT_DIR" -name "*.log"  -mtime +30 -delete 2>/dev/null || true
echo "▶ Cleanup: removed report files older than 30 days." | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "=== Done ===" | tee -a "$LOG_FILE"
