#!/usr/bin/env node
/**
 * InsureDesk — Gmail Email Sender (Nodemailer)
 *
 * Usage:
 *   node scripts/send-email-gmail.js \
 *     --to    "suneethakonjeti@gmail.com" \
 *     --subject "InsureDesk Stage Report — ✅ ALL PASSED" \
 *     --html  path/to/report.html
 *
 * Required env vars:
 *   GMAIL_USER      your Gmail address  (e.g. suneethakonjeti@gmail.com)
 *   GMAIL_APP_PASS  your 16-char App Password from Google (no spaces)
 */

const nodemailer = require('nodemailer');
const fs         = require('fs');
const path       = require('path');

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

const to      = getArg('--to')      || process.env.RECIPIENT_EMAIL;
const subject = getArg('--subject') || 'InsureDesk Stage Report';
const htmlFile = getArg('--html');

if (!to) {
  console.error('ERROR: Recipient email not set. Pass --to <email> or set RECIPIENT_EMAIL env var.');
  process.exit(1);
}

if (!htmlFile || !fs.existsSync(htmlFile)) {
  console.error(`ERROR: HTML report file not found: ${htmlFile}`);
  process.exit(1);
}

const gmailUser    = process.env.GMAIL_USER;
const gmailAppPass = process.env.GMAIL_APP_PASS;

if (!gmailUser || !gmailAppPass) {
  console.error('ERROR: GMAIL_USER and GMAIL_APP_PASS environment variables must be set.');
  console.error('  export GMAIL_USER="suneethakonjeti@gmail.com"');
  console.error('  export GMAIL_APP_PASS="xxxx xxxx xxxx xxxx"  # Gmail App Password');
  process.exit(1);
}

// ── Build transporter ─────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailUser,
    pass: gmailAppPass.replace(/\s+/g, ''),  // strip spaces if copy-pasted
  },
});

// ── Read HTML ─────────────────────────────────────────────────────────────────
const htmlContent = fs.readFileSync(htmlFile, 'utf8');

// ── Send ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    const info = await transporter.sendMail({
      from: `"InsureDesk CI" <${gmailUser}>`,
      to,
      subject,
      html: htmlContent,
      // Plain-text fallback
      text: `InsureDesk Stage Test Report\n\nView this email in an HTML-capable client.\n\nSent by InsureDesk CI — ${new Date().toLocaleString()}`,
    });

    console.log(`✅ Email sent to ${to}`);
    console.log(`   Message ID: ${info.messageId}`);
  } catch (err) {
    console.error(`❌ Failed to send email: ${err.message}`);
    if (err.message.includes('535') || err.message.includes('Username and Password')) {
      console.error('   → Check GMAIL_USER and GMAIL_APP_PASS values.');
      console.error('   → App Password must be generated at: myaccount.google.com/apppasswords');
      console.error('   → 2-Factor Authentication must be enabled on your Google account first.');
    }
    process.exit(1);
  }
})();
