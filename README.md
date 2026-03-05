# InsureDesk 360° — Insurance Customer Service Platform

![Tests](https://img.shields.io/badge/tests-234%20passing-brightgreen?style=for-the-badge)
![Coverage](https://img.shields.io/badge/coverage-100%25%20statements-brightgreen?style=for-the-badge)
![Version](https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge)

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
│   ├── playwright.config.stage.js   # Playwright E2E config (Stage)
│   └── tests/e2e/                   # 83 Playwright E2E tests
├── backend/                         # Node.js + Express API server
│   ├── server.js                    # Entry point
│   ├── src/
│   │   ├── config/                  # DB pool + logger
│   │   ├── middleware/              # JWT auth, role-based access, audit
│   │   ├── routes/                  # Express route handlers
│   │   └── services/                # Salesforce + Zendesk integrations
│   ├── tests/                       # 151 Jest tests (unit + API + DB + Stage)
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
# Unit + API tests with full coverage report (no DB needed)
cd backend && npm run test:ci

# DB integration tests (needs live DATABASE_URL)
DATABASE_URL="postgresql://..." npm run test:integration

# Stage E2E — Jest API tests (needs live Railway)
npm run test:stage

# Stage E2E — Playwright browser tests (needs live Vercel)
cd frontend && npx playwright test --config playwright.config.stage.js
```

See [TESTING.md](TESTING.md) for the full guide.

**Current test results: 234 / 234 passing**

| Suite | Tests | Status |
|-------|-------|--------|
| Unit (middleware + routes) | 68 | ✅ |
| API integration | 49 | ✅ |
| DB integration (live Railway) | 13 | ✅ |
| Stage API (Jest) | 28 | ✅ |
| Stage E2E (Playwright) | 83 | ✅ |

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
