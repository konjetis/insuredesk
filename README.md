# InsureDesk 360° — Insurance Customer Service Platform

![Tests](https://img.shields.io/badge/tests-188%20CI%20passing-brightgreen?style=for-the-badge)
![Coverage](https://img.shields.io/badge/coverage-100%25%20statements-brightgreen?style=for-the-badge)
![Version](https://img.shields.io/badge/version-1.2.0-blue?style=for-the-badge)

> A full-stack insurance customer service dashboard with role-based portals for Agents, Customers, Managers, and Admins — deployed on Vercel (frontend) and Railway (backend + PostgreSQL).

---

## Live Stage Environment

| Service | URL |
|---------|-----|
| Frontend | https://insuredesk-5ssw082eq-konjetis-projects.vercel.app |
| Backend API | https://insuredesk-production.up.railway.app |

---

## Portals

| Role | Access | Description |
|------|--------|-------------|
| **Admin** | All tabs | User management, agent performance, full system access |
| **Manager** | Manager + Agent + Customer tabs | Team scorecards, live alerts, call volume, CSAT |
| **Agent** | Agent tab only | Live call control, customer 360° profile, call queue |
| **Customer** | Customer tab only | Policy details, claim tracker, call history |

---

## Project Structure

```
insuredesk/
├── frontend/                        # Static HTML/CSS/JS dashboard
│   ├── login.html                   # Login page
│   ├── index.html                   # Main 360° dashboard (all 4 portals)
│   ├── playwright.config.stage.js   # Playwright E2E config (ui-stage + integration-stage)
│   └── tests/e2e/                   # 92 Playwright E2E tests (72 UI + 20 integration)
├── backend/                         # Node.js + Express API server
│   ├── server.js                    # Entry point
│   ├── src/
│   │   ├── config/                  # DB pool + logger
│   │   ├── middleware/              # JWT auth, role-based access, audit
│   │   ├── routes/                  # Express route handlers
│   │   └── services/                # Salesforce + Zendesk integrations
│   ├── tests/                       # 158 Jest tests (unit + API + DB + Stage)
│   ├── jest.config.js               # Unit + API test config (with coverage)
│   └── jest.config.stage.js         # Stage API test config
├── docs/                            # Project documentation
│   ├── InsureDesk_Project_Documentation.docx
│   ├── architecture-diagram.html
│   ├── flow-diagram.html
│   ├── API.md
│   └── ARCHITECTURE.md
├── scripts/                         # Automation scripts
│   ├── send-daily-report.sh         # Runs tests + emails HTML report
│   ├── generate-html-report.js      # Builds the HTML report
│   └── send-email-gmail.js          # Gmail SMTP sender (Nodemailer)
├── reports/                         # Generated test reports + run history
├── .github/workflows/ci.yml         # GitHub Actions CI pipeline
├── vercel.json                      # Vercel deployment config
├── TESTING.md                       # Full test suite guide
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js 18+, Express 4 |
| Database | PostgreSQL (Railway) |
| Auth | JWT (jsonwebtoken), bcrypt |
| WebSockets | Socket.io |
| Unit testing | Jest 25, mocked pg pool |
| E2E testing | Playwright |
| Email reports | Nodemailer + Gmail SMTP |
| Frontend deploy | Vercel (static) |
| Backend deploy | Railway |

---

## Quick Start

### Prerequisites
- Node.js v18+
- npm v9+
- PostgreSQL database (Railway or local)

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/insuredesk.git
cd insuredesk
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, PORT
```

### 3. Seed the Database
```bash
cd backend
node db-setup.js
```

### 4. Start the Backend
```bash
cd backend
npm install
npm run dev        # starts on port 3001
```

### 5. Open the Frontend
```bash
# Open frontend/login.html directly in your browser, or serve it:
npx serve frontend -l 3000
```

---

## Running Tests

```bash
# Suite 1 — Backend unit tests with coverage (no DB, no network)
cd backend && npm run test:ci

# Suite 2 — Backend API tests (needs live Railway)
npm run test:stage

# Suite 3 — Frontend UI tests (mocked backend, serves frontend locally)
cd frontend
python3 -m http.server 3000 --directory . &
STAGE_URL=http://localhost:3000 npx playwright test --config playwright.config.stage.js --project=ui-stage

# Suite 4 — E2E Integration tests (needs live Railway)
npx playwright test --config playwright.config.stage.js --project=integration-stage
```

See [TESTING.md](TESTING.md) for the full guide.

**CI pipeline: 4 suites, 188 tests total**

| Suite | Tool | Tests | Backend | Status |
|-------|------|-------|---------|--------|
| Suite 1 — Backend Unit Tests | Jest | 68 | None (mocked) | ✅ |
| Suite 2 — Backend API Tests | Jest | 28 | Live Railway | ✅ |
| Suite 3 — Frontend UI Tests | Playwright | 72 | Mocked | ✅ |
| Suite 4 — E2E Integration Tests | Playwright | 20 | Live Railway | ✅ |

---

## Daily Automated Reports

A HTML test report is emailed daily at 8 AM via Mac cron.
The report includes pass/fail counts, per-test durations, and a 7-run history bar chart.

Setup guide: [docs/DAILY_REPORT_SETUP.md](docs/DAILY_REPORT_SETUP.md)

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret key for signing JWTs |
| `PORT` | No | API port (default: 3001) |
| `JWT_EXPIRES_IN` | No | Token expiry (default: 8h) |
| `GMAIL_USER` | For email reports | Gmail address for sending reports |
| `GMAIL_APP_PASS` | For email reports | Gmail App Password (16 chars) |
| `STAGE_API_URL` | No | Override Stage API URL in reports |
| `STAGE_BASE_URL` | No | Override Stage frontend URL in reports |

---

## Documentation

- [TESTING.md](TESTING.md) — Full test suite guide
- [docs/API.md](docs/API.md) — REST API reference
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System architecture
- [docs/InsureDesk_Project_Documentation.docx](docs/InsureDesk_Project_Documentation.docx) — BRD, HLD, Scope
- [docs/architecture-diagram.html](docs/architecture-diagram.html) — Visual architecture diagram
- [docs/flow-diagram.html](docs/flow-diagram.html) — User flow diagrams
- [docs/DAILY_REPORT_SETUP.md](docs/DAILY_REPORT_SETUP.md) — Daily email report setup

---

## Security

- JWT authentication on all protected endpoints and WebSocket connections
- Role-based access control (`admin`, `manager`, `agent`, `customer`)
- bcrypt password hashing (10 rounds)
- Helmet.js security headers
- Express rate limiting
- HIPAA-ready audit logging (all user actions recorded)
- All secrets stored in environment variables — never committed

---

*Built for insurance customer service teams*
