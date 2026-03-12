# Changelog

All notable changes to InsureDesk are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [v1.2.0] — 2026-03-11

### Added
- **4-suite CI pipeline** — GitHub Actions now runs four explicitly named sequential suites
  on every `develop` push: Backend Unit Tests → Backend API Tests → Frontend UI Tests →
  E2E Integration Tests. All four must pass before `develop` is auto-promoted to `main`.
- **`tests/e2e/ui/` suite** — new Playwright project (`ui-stage`) with 72 deterministic
  frontend tests. All Railway data API calls are intercepted by mocks before page navigation;
  only the login token POST hits Railway. Zero flakiness from DB state or cold starts.
  Covers all four role panels: admin (33), agent (14), customer (12), manager (13).
- **`tests/e2e/integration/` suite** — new Playwright project (`integration-stage`) with
  20 E2E tests that hit live Railway. Verifies the real login form, token storage, error
  handling, and logout flow.
- **`tests/e2e/helpers/mocks.js`** — centralised mock data (`MOCK_USERS`, `MOCK_AGENT_SCORES`)
  and route setup helpers (`setupAdminMocks`, `setupManagerMocks`). Single source of truth
  for all deterministic test data; wraps data in `{ users: [...] }` matching what
  `loadUsers()` expects on the frontend.
- **`beforeNavigate` callback in `loginViaStorage`** — optional fifth parameter that runs
  after the CORS proxy is registered but before `page.goto('/index.html')`. Solves the
  page-init race: `index.html` auto-clicks the role tab on load, firing the first data API
  call before any test setup could register a mock. The callback registers mock routes in
  the LIFO slot that wins over the proxy, so the very first API call is intercepted.

### Changed
- **Playwright config split into two projects** — `playwright.config.stage.js` now defines
  `ui-stage` (testDir: `tests/e2e/ui`) and `integration-stage`
  (testDir: `tests/e2e/integration`) instead of one flat test directory.
- **CI pipeline restructured** — four named jobs replace the previous
  `backend-tests` / `full-suite` layout:
  `backend-unit-tests` → `backend-api-tests` → `frontend-ui-tests` → `e2e-integration-tests` → `promote-to-main`.
- **Test helpers reorganised** — `tests/e2e/helpers/auth.js` and the new `mocks.js` are
  the shared foundation for all Playwright specs. Flat spec files removed.

### Fixed
- **Critical mock body format bug** — previous mock sent `JSON.stringify(MOCK_USERS)` (bare
  array), but `loadUsers()` does `allUsers = data.users`, expecting `{ users: [...] }`.
  `data.users` was `undefined`, causing `renderUsers()` to silently throw and the users
  grid to display "Connection error" during every test run. Fixed in `mocks.js`.
- **E2E test flakiness root cause eliminated** — tests no longer depend on Railway cold-start
  timing for UI panel tests. All four UI specs are fully deterministic.

---

## [v1.1.0] — 2026-03-09

### Added
- **Web report hosting** — daily HTML report is now committed to `frontend/reports/daily-report.html`
  and served publicly via Vercel at `/reports/daily-report.html`.
- **Compact summary email** — daily email is now a single-screen summary card with a
  "📊 View Full Report" button linking to the hosted web report. No more scrolling through
  a full HTML dashboard in the inbox.
- **Release workflow** — new `release.yml` GitHub Actions workflow creates a GitHub Release
  automatically when a `v*.*.*` tag is pushed to `main`.
- **`frontend/reports/` directory** — tracked in git with `.gitkeep` so Vercel always has
  the directory available at deploy time.

### Changed
- **Admin screen** — removed bulk delete option (bulk action bar, per-user checkboxes,
  `bulkDelete()`, `updateBulkBar()`, `toggleSelectAll()` all removed from `frontend/index.html`).
- **Report generator** — reduced vertical padding throughout (`generate-html-report.js`);
  pass-rate bar merged into summary strip, saving one full scrollable row.
- **Stage URL standardisation** — all scripts and workflows now use the Vercel branch alias
  URL (`insuredesk-git-develop-konjetis-projects.vercel.app`) instead of the stale hash-based
  deployment URL.
- **Env var naming** — `playwright.config.stage.js` now accepts `STAGE_BASE_URL` (canonical)
  in addition to `STAGE_URL` (legacy / CI local-server override), removing the mismatch
  between the daily-report workflow and the Playwright config.
- **`run-stage-tests.sh`** — updated default frontend URL and variable name to `STAGE_BASE_URL`.

### Fixed
- `.gitignore` — added explicit exceptions so `reports/run-history.json` and
  `frontend/reports/daily-report.html` are tracked despite the `reports/` blanket rule.
- `frontend/package.json` — removed erroneous `nodemailer` devDependency (email sending
  belongs in the root/scripts layer, not the frontend).
- `scripts/send-email-gmail.js` — removed hardcoded recipient email fallback; script now
  fails fast with a clear error if `RECIPIENT_EMAIL` is not set.
- `scripts/send-daily-report.sh` — same: `RECIPIENT_EMAIL` is now required via
  bash `${VAR:?message}` pattern.

---

## [v1.0.0] — 2026-02-27

### Added
- Initial release of InsureDesk 360°.
- Express/Node.js backend with JWT auth, Salesforce integration, WebSocket support.
- Single-page frontend (HTML/CSS/JS) with role-based dashboards (Admin, Manager, Agent).
- Full test suite: Jest unit + API tests, Playwright E2E tests.
- CI/CD pipeline: GitHub Actions → auto-promote `develop` → `main` on green.
- Daily automated stage test report emailed via Gmail (Nodemailer).
- Run history chart tracking last 7 CI runs.
