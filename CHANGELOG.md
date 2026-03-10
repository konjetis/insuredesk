# Changelog

All notable changes to InsureDesk are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

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
