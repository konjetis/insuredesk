# InsureDesk — Test Suite Guide

Complete testing strategy covering unit tests (Jest), API integration tests,
backend DB integration tests, and frontend E2E automation (Playwright).

**Total: 233 tests — all passing**

| Suite | Tests | Requires |
|-------|-------|---------|
| Unit — middleware & routes | 68 | Nothing (all mocked) |
| API integration | 49 | Nothing (all mocked) |
| DB integration | 13 | Live `DATABASE_URL` |
| Stage E2E — Jest API | 28 | Live Stage environment |
| Stage E2E — Playwright | 82 | Live Stage environment |

---

## Quick Start

```bash
# 1. Install backend test dependencies
cd ~/Downloads/insuredesk/backend
npm install

# 2. Install frontend test dependencies
cd ~/Downloads/insuredesk/frontend
npm install --save-dev @playwright/test
npx playwright install          # downloads Chromium, Firefox, WebKit
```

---

## Backend — Unit Tests (Jest)

All DB calls are mocked — no database connection required.

```bash
cd ~/Downloads/insuredesk/backend

# Run ALL unit tests + coverage report
npm run test:unit

# Run ALL tests (unit + API mocked + coverage)
npm run test:all

# Watch mode (re-runs on file save)
npm run test:watch

# CI mode (exits cleanly after run)
npm run test:ci
```

### Files

| File | What it tests | Tests |
|------|---------------|-------|
| `tests/unit/middleware.auth.test.js` | `authenticateToken`, `requireRole`, `generateToken`, `authenticateSocket` | 21 |
| `tests/unit/routes.auth.test.js` | `POST /login`, `POST /register`, `GET /me` + 500 error paths | 21 |
| `tests/unit/routes.admin.test.js` | All admin CRUD endpoints + 500 error paths + password update | 26 |

### Coverage Results

| Metric | Actual | Threshold |
|--------|--------|-----------|
| Statements | **100%** ✅ | 70% |
| Lines | **100%** ✅ | 70% |
| Branches | **98.61%** ✅ | 65% |
| Functions | **94.11%** ✅ | 70% |

Coverage HTML report is generated at `backend/coverage/index.html`.

---

## Backend — API Integration Tests

These spin up a real Express app with a mocked DB — no real database needed.

```bash
cd ~/Downloads/insuredesk/backend

# Run only API tests
npm run test:api
```

### Files

| File | Endpoints covered | Tests |
|------|------------------|-------|
| `tests/api/auth.api.test.js` | `POST /login`, `POST /register`, `GET /me` | 16 |
| `tests/api/admin.api.test.js` | `GET /users`, `GET /agents`, `POST /users`, `PUT /users/:id`, `DELETE /users/:id` | 29 |
| `tests/api/health.api.test.js` | `GET /health` | 4 |

---

## Backend — Database Integration Tests

These run against the **real** Railway PostgreSQL database.
They are skipped automatically if `DATABASE_URL` is not set.

```bash
cd ~/Downloads/insuredesk/backend

# Get your public DATABASE_URL from Railway dashboard → PostgreSQL → Connect tab, then:
DATABASE_URL="postgresql://postgres:PASSWORD@tramway.proxy.rlwy.net:45849/railway" \
  npm run test:integration
```

### What it tests (13 tests)

- Live DB connection (`SELECT 1`)
- Schema: all required tables exist (`users`, `audit_logs`, `agent_performance`)
- Data integrity: at least one admin, valid role values, no null passwords
- Audit log: insert + retrieve + cleanup cycle
- Query performance: both main queries complete in < 500 ms

---

## Frontend — E2E Tests (Playwright)

Playwright controls a real Chromium browser against the live Stage frontend on Vercel.

### Running Stage E2E Tests

```bash
cd ~/Downloads/insuredesk/frontend

# Run all Stage E2E tests (82 tests)
npx playwright test --config playwright.config.stage.js

# Run a specific spec
npx playwright test --config playwright.config.stage.js tests/e2e/admin.spec.js

# Headed mode (watch the browser)
npx playwright test --config playwright.config.stage.js --headed

# View HTML report after run
npx playwright show-report
```

### Test Files

| File | Tab / Feature | Tests | Key scenarios |
|------|--------------|-------|---------------|
| `tests/e2e/login.spec.js` | Login page | ~10 | Form validation, wrong credentials, successful login, JWT storage, logout |
| `tests/e2e/agent.spec.js` | Agent tab | ~18 | Call queue, customer profile panel, call controls, history dates, animation stability |
| `tests/e2e/customer.spec.js` | Customer tab | ~18 | Policy card, claims tracker, billing dates, animation stability |
| `tests/e2e/manager.spec.js` | Manager tab | ~18 | Agent scorecards, metric cards, month badge, chart rendering |
| `tests/e2e/admin.spec.js` | Admin tab | ~19 | Users table, filter buttons, stat cards, Add User modal, access control |

### Stage Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@insuredesk.com | Admin@123 |
| Manager | sarah.manager@insuredesk.com | Manager@123 |
| Agent | alex.johnson@insuredesk.com | Agent@123 |
| Customer | marcus.roberts@customer.com | Customer@123 |

---

## All Tests at a Glance

```
insuredesk/
├── backend/
│   ├── jest.config.js                          ← Jest + coverage config (unit + API)
│   ├── jest.config.stage.js                    ← Jest config for Stage API tests
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── middleware.auth.test.js          ← 21 unit tests (JWT middleware + socket)
│   │   │   ├── routes.auth.test.js             ← 21 unit tests (auth routes + 500 paths)
│   │   │   └── routes.admin.test.js            ← 26 unit tests (admin CRUD + 500 paths)
│   │   ├── api/
│   │   │   ├── auth.api.test.js                ← 16 API integration tests
│   │   │   ├── admin.api.test.js               ← 29 API integration tests
│   │   │   └── health.api.test.js              ← 4 health endpoint tests
│   │   ├── integration/
│   │   │   └── database.test.js                ← 13 live DB integration tests
│   │   └── stage/
│   │       └── api.stage.test.js               ← 28 Stage API tests (live Railway)
└── frontend/
    ├── playwright.config.stage.js              ← Playwright Stage config (Vercel URL)
    └── tests/e2e/
        ├── login.spec.js                       ← Login + auth flow
        ├── agent.spec.js                       ← Agent tab E2E
        ├── customer.spec.js                    ← Customer tab E2E
        ├── manager.spec.js                     ← Manager tab E2E
        └── admin.spec.js                       ← Admin tab E2E
```

---

## CI/CD Integration

### Branch Strategy

The project uses a **2-branch workflow** to keep `main` stable at all times:

| Branch | Purpose | CI Jobs |
|--------|---------|---------|
| `develop` | Daily work, feature changes | Backend unit tests + coverage summary (fast, ~1 min) |
| `main` | Production-ready code only | Protected — merges via PR only |

### GitHub Branch Protection (main)

`main` is protected by a GitHub Ruleset with the following rules enforced:
- **Require a pull request before merging** — direct pushes to `main` are blocked
- **Require status checks to pass** — the `Full Suite — Stage + E2E (PR gate)` job must be green before the merge button becomes active
- **Restrict deletions** — branch cannot be accidentally deleted
- **Block force pushes** — no history rewrites on `main`

### CI Jobs (`.github/workflows/ci.yml`)

**On every push to `develop` or `main`:**
- `backend-tests` — runs Jest unit + API tests with coverage
- `coverage-summary` — prints a coverage table to the Actions log

**On every PR targeting `main` (full gate):**
- `full-suite` — runs Stage Jest API tests + all Playwright E2E tests against the Railway stage environment. Includes a Railway warmup step (up to 5 health-check pings) before tests begin.

### Release Workflow

```
develop  →  push  →  fast CI (unit tests only)
                          ↓
                   open PR: develop → main
                          ↓
              full-suite CI runs automatically
              (Stage Jest + Playwright E2E)
                          ↓
                   all checks green?
                          ↓
                    merge → main
                          ↓
               Vercel + Railway auto-deploy
```

### Run Tests Locally

```bash
# Locally replicate what CI runs:
cd ~/Downloads/insuredesk/backend
npm run test:ci          # unit + API tests with coverage (no DB, no Stage)
```
