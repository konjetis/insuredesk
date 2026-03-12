# InsureDesk — Test Suite Guide

Complete testing strategy covering backend unit tests (Jest), backend API tests (live Railway),
frontend UI tests (Playwright, mocked backend), and E2E integration tests (Playwright, live Railway).

**CI Pipeline: 4 suites — all must pass before develop is promoted to main**

| Suite | Tool | Tests | Backend | CI trigger |
|-------|------|-------|---------|------------|
| Suite 1 — Backend Unit Tests | Jest | 68 | None (all mocked) | Every push |
| Suite 2 — Backend API Tests | Jest | 28 | Live Railway | `develop` push |
| Suite 3 — Frontend UI Tests | Playwright | 72 | Mocked (no Railway) | `develop` push |
| Suite 4 — E2E Integration Tests | Playwright | 20 | Live Railway | `develop` push |

---

## Quick Start

```bash
# 1. Install backend test dependencies
cd ~/Downloads/insuredesk/backend
npm install

# 2. Install frontend test dependencies
cd ~/Downloads/insuredesk/frontend
npm install
npx playwright install --with-deps chromium
```

---

## Suite 1 — Backend Unit Tests (Jest)

All DB calls are mocked — no database connection required. Runs on every push to `develop` and `main`.

```bash
cd ~/Downloads/insuredesk/backend

# Run unit tests with coverage report
npm run test:ci

# Watch mode (re-runs on file save)
npm run test:watch
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

Coverage HTML report: `backend/coverage/index.html`

---

## Suite 2 — Backend API Tests (Jest, live Railway)

Jest stage tests that call the live Railway API. Verifies API contracts, authentication, DB
queries, and error responses. Runs only on `develop` pushes after Suite 1 passes.

```bash
cd ~/Downloads/insuredesk/backend

# Run Stage API tests (requires live Railway)
npm run test:stage
```

### Files

| File | Endpoints covered | Tests |
|------|------------------|-------|
| `tests/stage/api.stage.test.js` | Auth, admin CRUD, health — all against live Railway | 28 |

---

## Suite 3 — Frontend UI Tests (Playwright, mocked backend)

Playwright browser tests against a locally-served frontend. All Railway data API calls
(`/api/admin/users`, `/api/admin/agents`, etc.) are intercepted by deterministic mocks
before page navigation. Only the login token POST hits Railway — one fast call per test.

This architecture eliminates Railway cold-start flakiness and makes tests deterministic.

```bash
cd ~/Downloads/insuredesk/frontend

# Run UI tests only (no Railway warm-up required beyond login)
npx playwright test --config playwright.config.stage.js --project=ui-stage

# Run with visible browser
npx playwright test --config playwright.config.stage.js --project=ui-stage --headed

# View HTML report after run
npx playwright show-report playwright-report-stage
```

### How mocking works

The `loginViaStorage` helper in `tests/e2e/helpers/auth.js` accepts an optional
`beforeNavigate` callback. Mock route handlers are registered in this callback — after
the CORS proxy is set up (LIFO precedence) but before `page.goto('/index.html')`.

The page-init IIFE in `index.html` auto-clicks the role tab on load, which fires the
first data API call. Because the mock is registered before navigation, it intercepts
that very first call — no race condition, no inflight Railway response overwriting data.

Centralised mock data and route helpers live in `tests/e2e/helpers/mocks.js`.
The mock body is correctly wrapped as `{ users: [...] }` matching what `loadUsers()` expects.

### Test Files

| File | Tab / Feature | Tests | Key scenarios |
|------|--------------|-------|---------------|
| `tests/e2e/ui/admin.spec.js` | Admin tab | 33 | Users grid with mock data, filter buttons, stat cards, bulk checkboxes, Add User form, access control by role, animation stability |
| `tests/e2e/ui/agent.spec.js` | Agent tab | 14 | Call queue visibility, queue count stability, customer profile panel, call controls, history dates, animation stability |
| `tests/e2e/ui/customer.spec.js` | Customer tab | 12 | Panel visibility, personalised greeting, policy section, dynamic payment dates, call history dates, animation stability |
| `tests/e2e/ui/manager.spec.js` | Manager tab | 13 | Agent scorecard rows (mock data), metric stat cards, billing month badge, volume chart canvas, tab revisit stability |

### Stage Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@insuredesk.com | Admin@123 |
| Manager | jennifer.w@insuredesk.com | Manager@123 |
| Agent | alex.johnson@insuredesk.com | Agent@123 |
| Customer | marcus.roberts@customer.com | Customer@123 |

---

## Suite 4 — E2E Integration Tests (Playwright, live Railway)

Full auth flow tests against the live Railway backend. No mocking — every call hits Railway
to verify end-to-end behaviour. Tests the real login form, token storage, error handling,
and logout. Runs serially on `develop` after Suite 3 (Railway is already warm).

```bash
cd ~/Downloads/insuredesk/frontend

# Run E2E integration tests only (requires live Railway)
npx playwright test --config playwright.config.stage.js --project=integration-stage

# Run with visible browser
npx playwright test --config playwright.config.stage.js --project=integration-stage --headed
```

### Test Files

| File | Feature | Tests | Key scenarios |
|------|---------|-------|---------------|
| `tests/e2e/integration/login.spec.js` | Login + auth flow | 20 | Form rendering, validation, wrong credentials, successful token storage, dashboard redirect, logout, password visibility toggle |

---

## Additional Backend Tests (run locally, not in CI)

These tests exist for local development verification but are not part of the automated
CI pipeline.

### Backend API Integration Tests

Spins up a real Express app with a mocked DB — no real database needed.

```bash
cd ~/Downloads/insuredesk/backend
npm run test:api
```

| File | Endpoints covered | Tests |
|------|------------------|-------|
| `tests/api/auth.api.test.js` | `POST /login`, `POST /register`, `GET /me` | 16 |
| `tests/api/admin.api.test.js` | `GET /users`, `GET /agents`, `POST /users`, `PUT /users/:id`, `DELETE /users/:id` | 29 |
| `tests/api/health.api.test.js` | `GET /health` | 4 |

### Backend Database Integration Tests

Runs against the **real** Railway PostgreSQL database.
Skipped automatically if `DATABASE_URL` is not set.

```bash
cd ~/Downloads/insuredesk/backend

DATABASE_URL="postgresql://postgres:PASSWORD@tramway.proxy.rlwy.net:45849/railway" \
  npm run test:integration
```

What it tests (13 tests): live DB connection, schema validation (all required tables), data
integrity (at least one admin, valid role values, no null passwords), audit log cycle, and
query performance (both main queries < 500 ms).

---

## All Tests at a Glance

```
insuredesk/
├── backend/
│   ├── jest.config.js                          ← Jest config (unit + API tests with coverage)
│   ├── jest.config.stage.js                    ← Jest config for Stage API tests
│   └── tests/
│       ├── unit/
│       │   ├── middleware.auth.test.js          ← 21 unit tests (JWT middleware + socket)
│       │   ├── routes.auth.test.js             ← 21 unit tests (auth routes + 500 paths)
│       │   └── routes.admin.test.js            ← 26 unit tests (admin CRUD + 500 paths)
│       ├── api/
│       │   ├── auth.api.test.js                ← 16 API integration tests
│       │   ├── admin.api.test.js               ← 29 API integration tests
│       │   └── health.api.test.js              ← 4 health endpoint tests
│       ├── integration/
│       │   └── database.test.js                ← 13 live DB integration tests
│       └── stage/
│           └── api.stage.test.js               ← 28 Stage API tests (Suite 2 — live Railway)
└── frontend/
    ├── playwright.config.stage.js              ← Playwright config: ui-stage + integration-stage
    └── tests/e2e/
        ├── helpers/
        │   ├── auth.js                         ← loginViaStorage + beforeNavigate callback
        │   └── mocks.js                        ← MOCK_USERS, MOCK_AGENT_SCORES, setupAdminMocks, setupManagerMocks
        ├── ui/                                 ← Suite 3: mocked backend, fast & deterministic
        │   ├── admin.spec.js                   ← 33 UI tests (Admin tab)
        │   ├── agent.spec.js                   ← 14 UI tests (Agent tab)
        │   ├── customer.spec.js                ← 12 UI tests (Customer tab)
        │   └── manager.spec.js                 ← 13 UI tests (Manager tab)
        └── integration/                        ← Suite 4: live Railway, verify API contracts
            └── login.spec.js                   ← 20 E2E integration tests (login + auth flow)
```

---

## CI/CD Integration

### Branch Strategy

The project uses a **2-branch workflow** to keep `main` stable at all times:

| Branch | Purpose | CI Suites run |
|--------|---------|---------------|
| `develop` | Daily work, feature changes | All 4 suites — must all pass for auto-promote |
| `main` | Production-ready code only | Suite 1 only (sanity check) |

### 4-Suite Pipeline (`.github/workflows/ci.yml`)

```
Push to develop
      │
      ▼
Suite 1 — Backend Unit Tests       (backend-unit-tests)
  Jest unit tests, no network        Runs on every push to develop + main
  68 tests, ~1 min                   ↓ must pass
      │
      ▼
Suite 2 — Backend API Tests        (backend-api-tests)
  Jest stage tests, live Railway     develop only
  28 tests, ~2 min                   ↓ must pass
      │
      ▼
Suite 3 — Frontend UI Tests        (frontend-ui-tests)
  Playwright ui-stage, mocked        develop only
  72 tests, ~3 min                   ↓ must pass
      │
      ▼
Suite 4 — E2E Integration Tests    (e2e-integration-tests)
  Playwright integration-stage       develop only
  20 tests, ~2 min                   ↓ must pass
      │
      ▼
Auto-promote develop → main
      │
      ▼
Vercel + Railway auto-deploy to production
```

Suites 2–4 are sequential on `develop` pushes to avoid Railway rate-limiting.
Suite 1 also runs on `main` as a sanity check.

### Playwright Config — Two Projects

`frontend/playwright.config.stage.js` defines two projects using per-project `testDir`:

```js
projects: [
  // Suite 3: all data calls mocked, login token hits Railway
  { name: 'ui-stage',          testDir: './tests/e2e/ui' },
  // Suite 4: real Railway calls, verify end-to-end behaviour
  { name: 'integration-stage', testDir: './tests/e2e/integration' },
]
```

Override the frontend URL:
```bash
STAGE_BASE_URL=https://your-deploy.vercel.app \
  npx playwright test --config playwright.config.stage.js
```

### Run Tests Locally (replicate CI)

```bash
# Suite 1 — Backend unit tests
cd ~/Downloads/insuredesk/backend
npm run test:ci

# Suite 2 — Backend API tests (live Railway)
npm run test:stage

# Suite 3 — Frontend UI tests (serve frontend first)
cd ~/Downloads/insuredesk/frontend
python3 -m http.server 3000 --directory . &
STAGE_URL=http://localhost:3000 \
  npx playwright test --config playwright.config.stage.js --project=ui-stage

# Suite 4 — E2E Integration tests (live Railway)
npx playwright test --config playwright.config.stage.js --project=integration-stage
```
