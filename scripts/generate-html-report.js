#!/usr/bin/env node
/**
 * InsureDesk — HTML Report Generator
 * Reads JSON test outputs from Jest and Playwright, builds a styled HTML report.
 *
 * Usage:
 *   node scripts/generate-html-report.js \
 *     --jest    path/to/jest-results.json \
 *     --playwright path/to/playwright-results.json \
 *     --out     path/to/report.html
 */

const fs   = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

const jestFile       = getArg('--jest');
const playwrightFile = getArg('--playwright');
const outFile        = getArg('--out') || path.join(__dirname, '../reports/stage-report.html');

// ── Parse Jest JSON ──────────────────────────────────────────────────────────
let jestData = { numPassedTests: 0, numFailedTests: 0, numTotalTests: 0, testResults: [] };
if (jestFile && fs.existsSync(jestFile)) {
  jestData = JSON.parse(fs.readFileSync(jestFile, 'utf8'));
}

// ── Parse Playwright JSON ─────────────────────────────────────────────────────
let pwData = { stats: { expected: 0, unexpected: 0, skipped: 0 }, suites: [] };
if (playwrightFile && fs.existsSync(playwrightFile)) {
  pwData = JSON.parse(fs.readFileSync(playwrightFile, 'utf8'));
}

// ── Flatten Playwright results ────────────────────────────────────────────────
function flattenSuites(suites, results = []) {
  for (const suite of (suites || [])) {
    for (const spec of (suite.specs || [])) {
      for (const test of (spec.tests || [])) {
        results.push({
          suite: suite.title || suite.file || '',
          title: spec.title,
          status: test.status,
          duration: test.results && test.results[0] ? test.results[0].duration : 0,
          error: test.results && test.results[0] && test.results[0].error
            ? test.results[0].error.message : null,
        });
      }
    }
    if (suite.suites) flattenSuites(suite.suites, results);
  }
  return results;
}
const pwTests = flattenSuites(pwData.suites || []);
const pwPassed = pwTests.filter(t => t.status === 'expected' || t.status === 'passed').length;
const pwFailed = pwTests.filter(t => t.status === 'unexpected' || t.status === 'failed').length;
const pwTotal  = pwTests.length;

// ── Totals ─────────────────────────────────────────────────────────────────
const totalPassed = jestData.numPassedTests + pwPassed;
const totalFailed = jestData.numFailedTests + pwFailed;
const totalTests  = jestData.numTotalTests  + pwTotal;
const allPass     = totalFailed === 0 && totalTests > 0;

// ── Helpers ────────────────────────────────────────────────────────────────
const now = new Date();
const dateStr = now.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
const timeStr = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', timeZoneName:'short' });

function statusBadge(passed, failed, total) {
  if (failed > 0) return `<span class="badge fail">FAILED ${failed}/${total}</span>`;
  if (total === 0) return `<span class="badge skip">NO DATA</span>`;
  return `<span class="badge pass">PASSED ${passed}/${total}</span>`;
}

function pct(n, total) {
  return total === 0 ? '0' : Math.round((n / total) * 100);
}

// ── Jest suite rows ─────────────────────────────────────────────────────────
let jestRows = '';
for (const suite of jestData.testResults || []) {
  const suiteName = path.basename(suite.testFilePath || suite.name || 'unknown');
  const p = suite.numPassingTests || 0;
  const f = suite.numFailingTests || 0;
  const t = p + f;
  const icon = f > 0 ? '❌' : '✅';
  jestRows += `
    <tr>
      <td class="suite-name">${icon} ${suiteName}</td>
      <td class="center">${t}</td>
      <td class="center pass-text">${p}</td>
      <td class="center ${f > 0 ? 'fail-text' : ''}">${f}</td>
      <td class="center">${suite.perfStats ? Math.round(suite.perfStats.runtime / 1000) + 's' : '—'}</td>
    </tr>`;
  // failing test details
  for (const t of (suite.testResults || [])) {
    if (t.status === 'failed') {
      const msg = (t.failureMessages || []).join(' ').replace(/</g,'&lt;').replace(/>/g,'&gt;').substring(0, 300);
      jestRows += `
    <tr class="error-row">
      <td colspan="5"><span class="error-label">✗ ${t.fullName}</span><br><code>${msg}…</code></td>
    </tr>`;
    }
  }
}

// ── Playwright suite rows ──────────────────────────────────────────────────
const pwBySuite = {};
for (const t of pwTests) {
  const k = t.suite || 'Other';
  if (!pwBySuite[k]) pwBySuite[k] = { passed: 0, failed: 0, total: 0, failures: [] };
  pwBySuite[k].total++;
  if (t.status === 'expected' || t.status === 'passed') pwBySuite[k].passed++;
  else {
    pwBySuite[k].failed++;
    if (t.error) pwBySuite[k].failures.push({ title: t.title, error: t.error });
  }
}

let pwRows = '';
for (const [suite, data] of Object.entries(pwBySuite)) {
  const icon = data.failed > 0 ? '❌' : '✅';
  pwRows += `
    <tr>
      <td class="suite-name">${icon} ${suite}</td>
      <td class="center">${data.total}</td>
      <td class="center pass-text">${data.passed}</td>
      <td class="center ${data.failed > 0 ? 'fail-text' : ''}">${data.failed}</td>
      <td class="center">—</td>
    </tr>`;
  for (const f of data.failures) {
    const msg = (f.error || '').replace(/</g,'&lt;').replace(/>/g,'&gt;').substring(0, 300);
    pwRows += `
    <tr class="error-row">
      <td colspan="5"><span class="error-label">✗ ${f.title}</span><br><code>${msg}…</code></td>
    </tr>`;
  }
}

// ── HTML Template ─────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>InsureDesk Stage Report — ${dateStr}</title>
<style>
  :root {
    --primary: #1E3A5F;
    --accent:  #2563AB;
    --pass:    #16a34a;
    --fail:    #dc2626;
    --warn:    #d97706;
    --bg:      #f8fafc;
    --card:    #ffffff;
    --border:  #e2e8f0;
    --text:    #1e293b;
    --muted:   #64748b;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: var(--bg); color: var(--text); font-size: 14px; }
  .wrapper { max-width: 860px; margin: 0 auto; padding: 32px 24px; }

  /* Header */
  .header { display: flex; align-items: center; justify-content: space-between;
            border-bottom: 3px solid var(--primary); padding-bottom: 16px; margin-bottom: 28px; }
  .header-left h1 { font-size: 26px; color: var(--primary); font-weight: 800; }
  .header-left p  { color: var(--muted); font-size: 13px; margin-top: 4px; }
  .overall-badge  { font-size: 18px; font-weight: 700; padding: 10px 22px;
                    border-radius: 8px; text-align: center; }
  .overall-badge.all-pass  { background: #dcfce7; color: #14532d; border: 2px solid #4ade80; }
  .overall-badge.has-fail  { background: #fee2e2; color: #7f1d1d; border: 2px solid #f87171; }

  /* Summary cards */
  .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
  .card  { background: var(--card); border: 1px solid var(--border); border-radius: 10px;
           padding: 20px; text-align: center; }
  .card .num  { font-size: 36px; font-weight: 800; line-height: 1; }
  .card .lbl  { font-size: 12px; color: var(--muted); margin-top: 4px; letter-spacing: .05em; text-transform: uppercase; }
  .card.total .num { color: var(--primary); }
  .card.pass  .num { color: var(--pass); }
  .card.fail  .num { color: ${totalFailed > 0 ? 'var(--fail)' : 'var(--muted)'}; }

  /* Progress bar */
  .progress-wrap { background: var(--card); border: 1px solid var(--border); border-radius: 10px;
                   padding: 20px; margin-bottom: 28px; }
  .progress-wrap h3 { font-size: 13px; color: var(--muted); margin-bottom: 10px; text-transform: uppercase; }
  .bar-bg   { background: #fee2e2; border-radius: 6px; height: 20px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 6px; transition: width .4s;
              background: linear-gradient(90deg, #16a34a, #22c55e);
              width: ${pct(totalPassed, totalTests)}%; }
  .bar-lbl  { font-size: 12px; color: var(--muted); margin-top: 6px; text-align: right; }

  /* Section */
  .section { background: var(--card); border: 1px solid var(--border); border-radius: 10px;
             margin-bottom: 24px; overflow: hidden; }
  .section-header { background: var(--primary); color: #fff; padding: 12px 20px;
                    display: flex; align-items: center; justify-content: space-between; }
  .section-header h2 { font-size: 15px; font-weight: 700; }

  /* Table */
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #f1f5f9; }
  th, td   { padding: 10px 16px; text-align: left; border-bottom: 1px solid var(--border); }
  th       { font-size: 12px; text-transform: uppercase; color: var(--muted); font-weight: 600; }
  td.center { text-align: center; }
  td.suite-name { font-weight: 500; max-width: 380px; }
  .pass-text { color: var(--pass); font-weight: 700; }
  .fail-text { color: var(--fail); font-weight: 700; }
  tr:last-child td { border-bottom: none; }
  tr.error-row td  { background: #fff7f7; font-size: 12px; color: #7f1d1d; padding: 8px 16px; }
  tr.error-row .error-label { font-weight: 700; }
  tr.error-row code { display: block; margin-top: 4px; white-space: pre-wrap; word-break: break-all; opacity: .8; }

  /* Badge */
  .badge      { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 99px; }
  .badge.pass { background: #dcfce7; color: #14532d; }
  .badge.fail { background: #fee2e2; color: #7f1d1d; }
  .badge.skip { background: #fef3c7; color: #78350f; }

  /* Footer */
  .footer { text-align: center; color: var(--muted); font-size: 12px;
            margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border); }
</style>
</head>
<body>
<div class="wrapper">

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <h1>InsureDesk — Stage Test Report</h1>
      <p>${dateStr} &nbsp;·&nbsp; ${timeStr}</p>
    </div>
    <div class="overall-badge ${allPass ? 'all-pass' : 'has-fail'}">
      ${allPass ? '✅ ALL PASSED' : '❌ FAILURES DETECTED'}<br>
      <span style="font-size:13px;font-weight:500">${totalPassed} / ${totalTests} tests</span>
    </div>
  </div>

  <!-- Summary cards -->
  <div class="cards">
    <div class="card total"><div class="num">${totalTests}</div><div class="lbl">Total Tests</div></div>
    <div class="card pass"> <div class="num">${totalPassed}</div><div class="lbl">Passed</div></div>
    <div class="card fail"> <div class="num">${totalFailed || '0'}</div><div class="lbl">Failed</div></div>
  </div>

  <!-- Progress bar -->
  <div class="progress-wrap">
    <h3>Pass rate — ${pct(totalPassed, totalTests)}%</h3>
    <div class="bar-bg"><div class="bar-fill"></div></div>
    <div class="bar-lbl">${totalPassed} passed · ${totalFailed} failed · ${totalTests} total</div>
  </div>

  <!-- Backend API Tests -->
  <div class="section">
    <div class="section-header">
      <h2>🔧 Backend API Tests (Jest)</h2>
      ${statusBadge(jestData.numPassedTests, jestData.numFailedTests, jestData.numTotalTests)}
    </div>
    <table>
      <thead><tr><th>Suite</th><th class="center">Total</th><th class="center">Passed</th><th class="center">Failed</th><th class="center">Duration</th></tr></thead>
      <tbody>
        ${jestRows || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">No Jest data — run with --json flag</td></tr>'}
      </tbody>
    </table>
  </div>

  <!-- E2E Tests -->
  <div class="section">
    <div class="section-header">
      <h2>🎭 End-to-End Tests (Playwright)</h2>
      ${statusBadge(pwPassed, pwFailed, pwTotal)}
    </div>
    <table>
      <thead><tr><th>Spec</th><th class="center">Total</th><th class="center">Passed</th><th class="center">Failed</th><th class="center">Duration</th></tr></thead>
      <tbody>
        ${pwRows || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">No Playwright data — run with --reporter=json flag</td></tr>'}
      </tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="footer">
    InsureDesk · Automated Stage Test Report · Generated ${dateStr} ${timeStr}<br>
    Backend: <a href="https://insuredesk-production.up.railway.app">insuredesk-production.up.railway.app</a> &nbsp;·&nbsp;
    Frontend: <a href="https://insuredesk-5ssw082eq-konjetis-projects.vercel.app">Vercel Stage</a>
  </div>

</div>
</body>
</html>`;

// ── Write output ──────────────────────────────────────────────────────────
const outDir = path.dirname(outFile);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, html, 'utf8');
console.log(`HTML report written to: ${outFile}`);
console.log(`  Total: ${totalTests}  Passed: ${totalPassed}  Failed: ${totalFailed}`);
