# InsureDesk — Test Suite Guide

Complete testing strategy covering unit tests (Jest), API integration tests
(Supertest), backend DB integration scripts, and frontend E2E automation
(Playwright).

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

# Run ALL tests (unit + API mocked)
npm run test:all

# Watch mode (re-runs on file save)
npm run test:watch

# CI mode (exits cleanly after run)
npm run test:ci
```

### Files

| File | What it tests |
|------|---------------|
| `tests/unit/middleware.auth.test.js` | `authenticateToken`, `requireRole`, `generateToken` — 14 tests |
| `tests/unit/routes.auth.test.js` | `POST /login`, `POST /register`, `GET /me` — 18 tests |
| `tests/unit/routes.admin.test.js` | All admin CRUD endpoints — 18 tests |

### Coverage Targets

| Metric | Threshold |
|--------|-----------|
| Lines | 70% |
| Functions | 70% |
| Branches | 60% |
| Statements | 70% |

Coverage HTML report is generated at `backend/coverage/index.html`.

---

## Backend — API Integration Tests (Supertest)

These spin up a real Express app with a mocked DB — still no real database
needed.

```bash
cd ~/Downloads/insuredesk/backend

# Run only API tests
npm run test:api
```

### Files

| File | Endpoints covered |
|------|------------------|
| `tests/api/auth.api.test.js` | `POST /login`, `POST /register`, `GET /me` |
| `tests/api/admin.api.test.js` | `GET /users`, `GET /agents`, `POST /users`, `PUT /users/:id`, `DELETE /users/:id` |
| `tests/api/health.api.test.js` | `GET /health` |

---

## Backend — Database Integration Scripts

These run against the **real** Railway PostgreSQL database.
They are skipped automatically if `DATABASE_URL` is not set.

```bash
cd ~/Downloads/insuredesk/backend

# Get your public DATABASE_URL from Railway dashboard, then:
DATABASE_URL="postgresql://postgres:PASSWORD@tramway.proxy.rlwy.net:PORT/railway" \
  npm run test:integration
```

### What it tests

- Live DB connection (SELECT 1)
- Schema: all required tables exist (`users`, `audit_logs`, `agent_performance`)
- Data integrity: at least one admin, valid role values, no null passwords
- Audit log: insert + retrieve + cleanup cycle
- Query performance: both main queries complete in < 500 ms

---

## Frontend — E2E Tests (Playwright)

Playwright controls a real browser against the live frontend.

### Prerequisites

The frontend must be served locally or you must set `BASE_URL` to point at
the Railway deployment.

**Option A — local static server:**
```bash
# Install serve (one-time)
npm install -g serve

# Serve the frontend
serve ~/Downloads/insuredesk/frontend -l 3001
```

**Option B — Railway deployment:**
```bash
export BASE_URL="https://your-app.up.railway.app"
```

### Running Tests

```bash
cd ~/Downloads/insuredesk/frontend

# All browsers (Chromium + Firefox + WebKit + Mobile Chrome)
npx playwright test

# Chromium only (fastest)
npx playwright test --project=chromium

# Specific spec file
npx playwright test tests/e2e/login.spec.js

# Headed mode (watch browser)
npx playwright test --headed --project=chromium

# Interactive UI mode
npx playwright test --ui

# View HTML report after run
npx playwright show-report
```

### Test Files

| File | Tab / Feature | Key scenarios |
|------|--------------|---------------|
| `tests/e2e/login.spec.js` | Login page | Form validation, wrong credentials, successful login, JWT storage, logout |
| `tests/e2e/agent.spec.js` | Agent tab | Call queue, customer profile panel, call controls, history dates, animation stability |
| `tests/e2e/customer.spec.js` | Customer tab | Dynamic greeting (no "Sarah"), policy card, claims tracker, billing dates, animation stability |
| `tests/e2e/manager.spec.js` | Manager tab | Agent scorecards, metric cards, month badge, chart rendering, animation stability |
| `tests/e2e/admin.spec.js` | Admin tab | Users table, all 5 filter buttons, stat cards, Add User modal, access control for agents |

### Demo Credentials (after db-setup.js seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@insuredesk.com | Admin@123 |
| Manager | sarah.manager@insuredesk.com | Manager@123 |
| Agent | alex@insuredesk.com | Agent@123 |
| Customer | john.smith@email.com | Customer@123 |

---

## All Tests at a Glance

```
insuredesk/
├── backend/
│   ├── jest.config.js                        ← Jest + coverage config
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── middleware.auth.test.js        ← 14 unit tests (JWT middleware)
│   │   │   ├── routes.auth.test.js           ← 18 unit tests (auth routes)
│   │   │   └── routes.admin.test.js          ← 18 unit tests (admin routes)
│   │   ├── api/
│   │   │   ├── auth.api.test.js              ← Supertest: auth endpoints
│   │   │   ├── admin.api.test.js             ← Supertest: admin endpoints
│   │   │   └── health.api.test.js            ← Supertest: /health
│   │   └── integration/
│   │       └── database.test.js              ← Live DB integration scripts
└── frontend/
    ├── playwright.config.js                  ← Playwright configuration
    └── tests/e2e/
        ├── login.spec.js                     ← Login + auth flow
        ├── agent.spec.js                     ← Agent tab E2E
        ├── customer.spec.js                  ← Customer tab E2E
        ├── manager.spec.js                   ← Manager tab E2E
        └── admin.spec.js                     ← Admin tab E2E
```

---

## CI/CD Integration

Add this to your Railway or GitHub Actions workflow:

```yaml
- name: Run backend unit + API tests
  run: |
    cd backend
    npm ci
    npm run test:ci

- name: Run Playwright E2E tests
  run: |
    cd frontend
    npm ci
    npx playwright install --with-deps
    BASE_URL=${{ secrets.RAILWAY_URL }} npx playwright test --project=chromium
```
