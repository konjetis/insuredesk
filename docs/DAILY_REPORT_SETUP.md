# InsureDesk — Daily Stage Email Report Setup

Runs all Stage tests each morning at 8 AM and emails a styled HTML report to **suneethakonjeti@gmail.com** using your existing Gmail account.

---

## 1. Enable 2-Factor Authentication on Google

If you haven't already:

1. Go to [myaccount.google.com/security](https://myaccount.google.com/security)
2. Under **"How you sign in to Google"**, click **2-Step Verification** and turn it on

> This is required before Google will let you generate App Passwords.

---

## 2. Generate a Gmail App Password

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Under **"App name"**, type `InsureDesk CI`
3. Click **Create**
4. Google shows you a **16-character password** (e.g. `abcd efgh ijkl mnop`) — copy it now

---

## 3. Add Credentials to Your Shell

Open `~/.zshrc` (or `~/.bash_profile`) and add these two lines:

```bash
export GMAIL_USER="suneethakonjeti@gmail.com"
export GMAIL_APP_PASS="abcd efgh ijkl mnop"   # paste your App Password here
```

Save the file, then reload:

```bash
source ~/.zshrc
```

---

## 4. Install Nodemailer (one time)

From inside the `insuredesk` project folder:

```bash
npm install nodemailer --save-dev
```

---

## 5. Test It Manually First

```bash
cd /path/to/insuredesk
bash scripts/send-daily-report.sh
```

Expected output:
```
=== InsureDesk Daily Stage Report — Wednesday, March 4, 2026 ===
▶ Running Backend API tests (Jest)...
  ✅ Jest: all tests passed
▶ Running E2E tests (Playwright)...
  ✅ Playwright: all tests passed
▶ Generating HTML report...
▶ Sending email to suneethakonjeti@gmail.com via Gmail...
  ✅ Email sent to suneethakonjeti@gmail.com
=== Done ===
```

The report will arrive in your Gmail inbox with subject:
`InsureDesk Stage Report — ✅ ALL PASSED — Wednesday, March 4, 2026`

---

## 6. Schedule Daily at 8 AM (Mac Cron)

Open your crontab:

```bash
crontab -e
```

Add these lines (replace the path with your actual project path):

```cron
PATH=/usr/local/bin:/usr/bin:/bin
0 8 * * * cd /Users/suneetha/path/to/insuredesk && bash scripts/send-daily-report.sh >> /tmp/insuredesk-daily.log 2>&1
```

Save and verify it was added:

```bash
crontab -l
```

> **macOS note:** Cron needs **Full Disk Access** to run.
> Go to **System Settings → Privacy & Security → Full Disk Access** → click **+** → navigate to `/usr/sbin/cron` → add it.

---

## What the Email Contains

| Section | Details |
|---------|---------|
| Header | Date, time, overall ✅ PASSED / ❌ FAILED status |
| Summary cards | Total tests · Passed · Failed |
| Pass-rate bar | Visual percentage bar |
| Backend API results | 28 tests grouped by suite with pass/fail counts |
| E2E results | 83 tests grouped by spec file |
| Failure details | Expanded error messages for any failing tests |

---

## Files

| File | Purpose |
|------|---------|
| `scripts/send-daily-report.sh` | Main daily script — runs tests, builds report, sends email |
| `scripts/generate-html-report.js` | Parses Jest + Playwright JSON into a styled HTML report |
| `scripts/send-email-gmail.js` | Nodemailer Gmail sender (called by the shell script) |
| `reports/` | Auto-created — stores JSON + HTML outputs (30-day retention) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `GMAIL_USER and GMAIL_APP_PASS are not set` | Add to `~/.zshrc` and run `source ~/.zshrc` |
| `535 Username and Password not accepted` | App Password is wrong or 2FA isn't enabled — regenerate at myaccount.google.com/apppasswords |
| `nodemailer is not installed` | Run `npm install nodemailer --save-dev` in the project folder |
| Tests fail with connection error | Ensure your Mac is online and Railway/Vercel are reachable |
| Cron doesn't fire | Add Full Disk Access for `/usr/sbin/cron` in System Settings |
| Cron can't find `node` or `npx` | Add `PATH=/usr/local/bin:/usr/bin:/bin` as the first line in your crontab |
| Email goes to spam | Add yourself as a contact; Gmail → Settings → Filters → never send to spam |
