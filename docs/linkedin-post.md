# LinkedIn Post — InsureDesk + Claude Cowork

---

I just built a production-grade, full-stack insurance dashboard — complete with a full test suite, CI/CD pipeline, automated daily reports, and professional documentation — with the help of Claude Cowork. Here's what that actually looked like. 🧵

**The project: InsureDesk 360°**
A real-time customer service dashboard for insurance teams — role-based portals for Agents, Customers, Managers, and Admins, deployed on Vercel (frontend) and Railway (backend + PostgreSQL).

**What Claude helped me build end to end:**

🧪 **234 tests — all passing**
- Unit tests with 100% statement & line coverage (mocked DB, no live connection needed)
- API integration tests for every endpoint
- Live database integration tests against Railway PostgreSQL
- 83 Playwright E2E browser tests covering every role and user flow

🤖 **Full CI/CD pipeline**
- GitHub Actions runs unit + API tests on every push to main
- Daily report workflow at 8 AM CST — runs all tests, generates a polished HTML report, and emails it automatically. No laptop needed.

📊 **Automated daily email report**
- Pass/fail counts, per-test durations, coverage metrics
- 7-run history bar chart so you can see trends at a glance
- Fully cloud-hosted via GitHub Actions (previously Mac cron — we upgraded that too)

📁 **Complete project documentation**
- BRD, HLD, Scope document (.docx)
- Architecture diagram & user flow diagrams
- API reference, testing guide, README — all kept in sync

**What surprised me most about working with Claude Cowork:**

It wasn't just writing code. Claude caught things I hadn't thought about — stale test counts in docs, a phantom directory from a mistyped bash command, outdated API docs referencing endpoints that didn't match the actual codebase. It reviewed the work, flagged the gaps, and fixed them.

The conversation felt less like prompting an AI and more like pairing with a senior engineer who actually reads what they write.

**The stack:**
Node.js · Express · PostgreSQL · Vercel · Railway · Jest · Playwright · GitHub Actions · Nodemailer · JWT · bcrypt

What would have taken a solo developer 3–4 months was done in a fraction of that time — without sacrificing quality.

If you're building something and want to move fast without cutting corners on quality — this is genuinely worth trying.

#AI #ClaudeAI #SoftwareDevelopment #Testing #CICD #FullStack #GitHub #NodeJS #Playwright #BuildInPublic
