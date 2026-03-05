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
const coverageFile   = getArg('--coverage');
const outFile        = getArg('--out') || path.join(__dirname, '../reports/stage-report.html');

// ── Environment config (override via env vars) ────────────────────────────────
const STAGE_API_URL  = process.env.STAGE_API_URL  || 'https://insuredesk-production.up.railway.app';
const STAGE_BASE_URL = process.env.STAGE_BASE_URL || 'https://insuredesk-5ssw082eq-konjetis-projects.vercel.app';
const JEST_VERSION   = process.env.JEST_VERSION   || 'Jest 25';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMs(ms) {
  if (!ms || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

function pct(n, total) {
  return total === 0 ? '0' : Math.round((n / total) * 100);
}

// ── Parse Jest JSON ───────────────────────────────────────────────────────────
// Jest 25 structure:
//   jestData.numPassedTests / numFailedTests / numTotalTests / startTime
//   jestData.testResults[] → suite
//     suite.name, suite.startTime, suite.endTime, suite.status
//     suite.assertionResults[] → individual test
//       test.fullName, test.status ('passed'|'failed'|'pending')
let jestData = { numPassedTests: 0, numFailedTests: 0, numTotalTests: 0, testResults: [], startTime: 0 };
if (jestFile && fs.existsSync(jestFile)) {
  try { jestData = JSON.parse(fs.readFileSync(jestFile, 'utf8')); } catch(e) {}
}

let jestTotalDurationMs = 0;
let jestRows = '';

for (const suite of jestData.testResults || []) {
  const suiteName   = path.basename(suite.name || suite.testFilePath || 'unknown');
  const tests       = suite.assertionResults || suite.testResults || [];
  const passed      = tests.filter(t => t.status === 'passed').length;
  const failed      = tests.filter(t => t.status === 'failed').length;
  const total       = tests.length;
  const durationMs  = (suite.endTime && suite.startTime) ? (suite.endTime - suite.startTime) : 0;
  jestTotalDurationMs += durationMs;

  jestRows += `
    <tr>
      <td class="suite-name">
        <span class="row-status">
          <span class="sdot ${failed > 0 ? 'f' : 'p'}"></span>
          ${suiteName}
        </span>
      </td>
      <td class="tc">${total}</td>
      <td class="tc pass-num">${passed}</td>
      <td class="tc ${failed > 0 ? 'fail-num' : 'zero-num'}">${failed > 0 ? failed : '0'}</td>
      <td class="mono">${fmtMs(durationMs)}</td>
    </tr>`;

  for (const t of tests) {
    if (t.status === 'failed') {
      const msg = (t.failureMessages || []).join(' ')
        .replace(/</g,'&lt;').replace(/>/g,'&gt;').substring(0, 400);
      jestRows += `
    <tr class="err-row">
      <td colspan="5"><div class="err-title">✗ ${t.fullName}</div><code>${msg}</code></td>
    </tr>`;
    }
  }
}

// ── Parse Playwright JSON ─────────────────────────────────────────────────────
// Playwright structure:
//   pwData.stats.duration (total ms), stats.expected, stats.unexpected
//   pwData.suites[] → nested suites → specs[] → tests[] → results[]
//     result.duration (ms), result.status ('passed'|'failed')
//     test.status ('expected'|'unexpected'|'flaky')
let pwData = { stats: { expected: 0, unexpected: 0, skipped: 0, duration: 0 }, suites: [] };
if (playwrightFile && fs.existsSync(playwrightFile)) {
  try { pwData = JSON.parse(fs.readFileSync(playwrightFile, 'utf8')); } catch(e) {}
}

const pwTotalDurationMs = pwData.stats ? (pwData.stats.duration || 0) : 0;

function flattenSuites(suites, parentFile, results = []) {
  for (const suite of (suites || [])) {
    const file = suite.file || parentFile || suite.title || 'Other';
    for (const spec of (suite.specs || [])) {
      for (const test of (spec.tests || [])) {
        const result = test.results && test.results[0];
        results.push({
          file,
          title: spec.title,
          passed: test.status === 'expected' || test.status === 'passed',
          failed: test.status === 'unexpected' || test.status === 'failed',
          duration: result ? (result.duration || 0) : 0,
          error: result && result.error ? result.error.message : null,
        });
      }
    }
    flattenSuites(suite.suites, file, results);
  }
  return results;
}

const pwTests  = flattenSuites(pwData.suites || []);
const pwPassed = pwTests.filter(t => t.passed).length;
const pwFailed = pwTests.filter(t => t.failed).length;
const pwTotal  = pwTests.length;

// Group by file, sum duration per file
const pwByFile = {};
for (const t of pwTests) {
  const k = path.basename(t.file || 'Other');
  if (!pwByFile[k]) pwByFile[k] = { passed: 0, failed: 0, total: 0, durationMs: 0, failures: [] };
  pwByFile[k].total++;
  pwByFile[k].durationMs += t.duration;
  if (t.passed) pwByFile[k].passed++;
  else {
    pwByFile[k].failed++;
    if (t.error) pwByFile[k].failures.push({ title: t.title, error: t.error });
  }
}

let pwRows = '';
for (const [file, data] of Object.entries(pwByFile)) {
  pwRows += `
    <tr>
      <td class="suite-name">
        <span class="row-status">
          <span class="sdot ${data.failed > 0 ? 'f' : 'p'}"></span>
          ${file}
        </span>
      </td>
      <td class="tc">${data.total}</td>
      <td class="tc pass-num">${data.passed}</td>
      <td class="tc ${data.failed > 0 ? 'fail-num' : 'zero-num'}">${data.failed > 0 ? data.failed : '0'}</td>
      <td class="mono">${fmtMs(data.durationMs)}</td>
    </tr>`;
  for (const f of data.failures) {
    const msg = (f.error || '').replace(/</g,'&lt;').replace(/>/g,'&gt;').substring(0, 400);
    pwRows += `
    <tr class="err-row">
      <td colspan="5"><div class="err-title">✗ ${f.title}</div><code>${msg}</code></td>
    </tr>`;
  }
}

// ── Parse Coverage Summary JSON ───────────────────────────────────────────────
// Jest writes backend/coverage/coverage-summary.json when run with --coverage
// Structure: { total: { statements:{pct}, branches:{pct}, functions:{pct}, lines:{pct} } }
let cov = null;
if (coverageFile && fs.existsSync(coverageFile)) {
  try {
    const raw = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
    cov = raw.total || null;
  } catch(e) {}
}

function covPct(metric) {
  return cov && cov[metric] ? Math.round(cov[metric].pct) : null;
}

function covBar(pct) {
  if (pct === null) return '';
  const color = pct >= 90 ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626';
  return `
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="flex:1;background:#e2e8f0;border-radius:99px;height:8px;overflow:hidden;">
        <div style="width:${Math.min(pct,100)}%;height:100%;background:${color};border-radius:99px;"></div>
      </div>
      <span style="font-size:13px;font-weight:700;color:${color};min-width:42px;text-align:right;">${pct}%</span>
    </div>`;
}

function covSection() {
  if (!cov) return '';
  const metrics = [
    { label: 'Statements', key: 'statements', icon: '📄' },
    { label: 'Branches',   key: 'branches',   icon: '🔀' },
    { label: 'Functions',  key: 'functions',   icon: '𝑓' },
    { label: 'Lines',      key: 'lines',       icon: '📏' },
  ];
  const cards = metrics.map(m => {
    const p = covPct(m.key);
    const color = p >= 90 ? '#16a34a' : p >= 70 ? '#d97706' : '#dc2626';
    const bg    = p >= 90 ? '#f0fdf4' : p >= 70 ? '#fffbeb' : '#fef2f2';
    return `
      <div style="flex:1;min-width:140px;background:${bg};border-radius:12px;padding:16px 14px;text-align:center;border:1px solid ${color}22;">
        <div style="font-size:20px;margin-bottom:6px;">${m.icon}</div>
        <div style="font-size:26px;font-weight:800;color:${color};line-height:1;">${p}%</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">${m.label}</div>
        <div style="margin-top:8px;">${covBar(p)}</div>
      </div>`;
  }).join('');

  const stmts = covPct('statements');
  const allGreen = ['statements','branches','functions','lines'].every(k => covPct(k) >= 90);

  return `
  <!-- ── Unit Test Coverage ── -->
  <div class="section">
    <div class="section-head">
      <div class="section-head-left">
        <div class="section-head-icon" style="background:#ecfdf5;">📊</div>
        <div>
          <h2>Unit Test Coverage</h2>
          <div class="s-meta">Jest — src/middleware + src/routes &nbsp;·&nbsp; Mocked DB</div>
        </div>
      </div>
      <span class="sbadge ${allGreen ? 'pass' : stmts >= 70 ? 'pass' : 'fail'}">
        ${allGreen ? '✅ Excellent' : stmts >= 70 ? '✅ Above threshold' : '❌ Below threshold'}
      </span>
    </div>
    <div style="padding:20px 24px;">
      <div style="display:flex;gap:14px;flex-wrap:wrap;">
        ${cards}
      </div>
      <div style="margin-top:14px;font-size:11px;color:#94a3b8;text-align:right;">
        Thresholds: Statements ≥70% · Branches ≥65% · Functions ≥70% · Lines ≥70%
      </div>
    </div>
  </div>`;
}

// ── Totals ────────────────────────────────────────────────────────────────────
const totalPassed   = jestData.numPassedTests + pwPassed;
const totalFailed   = jestData.numFailedTests + pwFailed;
const totalTests    = jestData.numTotalTests  + pwTotal;
const totalDuration = jestTotalDurationMs + pwTotalDurationMs;
const allPass       = totalFailed === 0 && totalTests > 0;

const now     = new Date();
const dateStr = now.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
const timeStr = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', timeZoneName:'short' });

// ── Run history (persist last 7 runs) ────────────────────────────────────────
const historyFile = path.join(path.dirname(outFile), 'run-history.json');
let history = [];
if (fs.existsSync(historyFile)) {
  try { history = JSON.parse(fs.readFileSync(historyFile, 'utf8')); } catch(e) {}
}
// Add current run
if (totalTests > 0) {
  history.push({
    ts:       now.toISOString(),
    label:    now.toLocaleDateString('en-US', { month:'short', day:'numeric' }) + ' ' +
              now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' }),
    total:    totalTests,
    passed:   totalPassed,
    failed:   totalFailed,
    duration: totalDuration,
    pass:     allPass,
  });
  // Keep last 7
  if (history.length > 7) history = history.slice(-7);
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
}

// Build history HTML (oldest → newest, left → right)
function historyHTML(runs) {
  if (!runs || runs.length === 0) return '';
  const maxTests = Math.max(...runs.map(r => r.total), 1);

  const bars = runs.map((r, i) => {
    const isLatest  = i === runs.length - 1;
    const passH     = Math.round((r.passed / maxTests) * 80);
    const failH     = Math.round((r.failed / maxTests) * 80);
    const barColor  = r.pass ? '#16a34a' : '#dc2626';
    const failColor = '#f87171';
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;min-width:0;">
        <!-- bar -->
        <div style="width:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:88px;gap:1px;">
          ${r.failed > 0 ? `<div style="width:28px;background:${failColor};border-radius:4px 4px 0 0;height:${failH}px;" title="${r.failed} failed"></div>` : ''}
          <div style="width:28px;background:${barColor};border-radius:${r.failed > 0 ? '0' : '4px 4px 0 0'};height:${passH}px;" title="${r.passed} passed"></div>
        </div>
        <!-- count -->
        <div style="font-size:11px;font-weight:700;color:${r.pass ? '#16a34a' : '#dc2626'};">${r.passed}/${r.total}</div>
        <!-- label -->
        <div style="font-size:10px;color:#94a3b8;text-align:center;line-height:1.3;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.label}</div>
        <!-- duration -->
        <div style="font-size:10px;color:#cbd5e1;font-family:monospace;">${fmtMs(r.duration)}</div>
        ${isLatest ? `<div style="font-size:9px;font-weight:700;color:#2563AB;letter-spacing:.05em;text-transform:uppercase;">Latest</div>` : ''}
      </div>`;
  }).join('');

  // Trend: compare last run to previous
  let trendHTML = '';
  if (runs.length >= 2) {
    const prev = runs[runs.length - 2];
    const curr = runs[runs.length - 1];
    const diff = curr.passed - prev.passed;
    if (diff > 0)       trendHTML = `<span style="color:#16a34a;font-weight:700;">↑ +${diff} vs previous</span>`;
    else if (diff < 0)  trendHTML = `<span style="color:#dc2626;font-weight:700;">↓ ${diff} vs previous</span>`;
    else                trendHTML = `<span style="color:#64748b;">→ No change vs previous</span>`;
  }

  return `
  <!-- ── Run History ── -->
  <div class="section" style="margin-bottom:0;">
    <div class="section-head">
      <div class="section-head-left">
        <div class="section-head-icon" style="background:#f0f4ff;">📈</div>
        <div>
          <h2>Run History</h2>
          <div class="s-meta">Last ${runs.length} run${runs.length > 1 ? 's' : ''} &nbsp;·&nbsp; ${trendHTML}</div>
        </div>
      </div>
      <span style="font-size:11px;color:#94a3b8;">Oldest → Latest</span>
    </div>
    <div style="padding:24px 28px;">
      <!-- chart -->
      <div style="display:flex;gap:8px;align-items:flex-end;border-bottom:2px solid #e2e8f0;padding-bottom:12px;margin-bottom:16px;">
        ${bars}
      </div>
      <!-- legend -->
      <div style="display:flex;gap:20px;font-size:11px;color:#64748b;flex-wrap:wrap;">
        <span style="display:flex;align-items:center;gap:5px;">
          <span style="width:10px;height:10px;border-radius:2px;background:#16a34a;display:inline-block;"></span> Passed
        </span>
        <span style="display:flex;align-items:center;gap:5px;">
          <span style="width:10px;height:10px;border-radius:2px;background:#f87171;display:inline-block;"></span> Failed
        </span>
        <span style="display:flex;align-items:center;gap:5px;">
          <span style="width:10px;height:10px;border-radius:2px;background:#e2e8f0;display:inline-block;"></span> Duration shown below each bar
        </span>
      </div>
      <!-- history table -->
      <table style="margin-top:16px;font-size:12px;">
        <thead>
          <tr>
            <th>Run</th><th class="tc">Total</th><th class="tc">Passed</th>
            <th class="tc">Failed</th><th class="tc">Duration</th><th class="tc">Status</th>
          </tr>
        </thead>
        <tbody>
          ${runs.map((r, i) => `
          <tr ${i === runs.length - 1 ? 'style="background:#f8fafc;"' : ''}>
            <td style="font-size:11px;color:#475569;">${r.label}</td>
            <td class="tc">${r.total}</td>
            <td class="tc pass-num">${r.passed}</td>
            <td class="tc ${r.failed > 0 ? 'fail-num' : 'zero-num'}">${r.failed}</td>
            <td class="mono">${fmtMs(r.duration)}</td>
            <td class="tc">
              <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;
                background:${r.pass ? '#f0fdf4' : '#fef2f2'};
                color:${r.pass ? '#16a34a' : '#dc2626'};">
                ${r.pass ? '✅ Pass' : '❌ Fail'}
              </span>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function statusBadge(passed, failed, total) {
  if (total === 0)  return `<span class="badge skip">NO DATA</span>`;
  if (failed > 0)   return `<span class="badge fail">FAILED ${failed}/${total}</span>`;
  return              `<span class="badge pass">PASSED ${passed}/${total}</span>`;
}

// ── HTML ──────────────────────────────────────────────────────────────────────
const passRate = pct(totalPassed, totalTests);
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>InsureDesk Stage Report — ${dateStr}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  :root {
    --primary:  #1E3A5F;
    --accent:   #2563AB;
    --pass:     #16a34a;
    --pass-bg:  #f0fdf4;
    --pass-mid: #86efac;
    --fail:     #dc2626;
    --fail-bg:  #fef2f2;
    --warn:     #d97706;
    --bg:       #f1f5f9;
    --card:     #ffffff;
    --border:   #e2e8f0;
    --text:     #0f172a;
    --muted:    #64748b;
    --purple:   #7c3aed;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Page shell ── */
  .page-header {
    background: linear-gradient(135deg, #1E3A5F 0%, #2563AB 100%);
    padding: 36px 40px 32px;
    color: #fff;
  }
  .page-header-inner {
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
  }
  .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .brand-icon {
    width: 42px; height: 42px; border-radius: 10px;
    background: rgba(255,255,255,.18);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
  }
  .brand-name { font-size: 22px; font-weight: 800; letter-spacing: -.3px; }
  .brand-sub  { font-size: 13px; opacity: .75; margin-top: 1px; }
  .header-date { font-size: 13px; opacity: .7; margin-top: 6px; }

  .status-pill {
    display: flex; flex-direction: column; align-items: center;
    padding: 14px 24px; border-radius: 14px;
    font-weight: 700; text-align: center; min-width: 160px;
    backdrop-filter: blur(8px);
    flex-shrink: 0;
  }
  .status-pill.pass { background: rgba(134,239,172,.22); border: 1.5px solid rgba(134,239,172,.5); }
  .status-pill.fail { background: rgba(252,165,165,.22); border: 1.5px solid rgba(252,165,165,.5); }
  .status-pill .pill-icon { font-size: 28px; line-height: 1; margin-bottom: 4px; }
  .status-pill .pill-label { font-size: 14px; letter-spacing: .02em; }
  .status-pill .pill-count { font-size: 12px; opacity: .8; margin-top: 2px; font-weight: 500; }

  /* ── Body wrapper ── */
  .wrapper { max-width: 860px; margin: 0 auto; padding: 28px 20px 48px; }

  /* ── Stat cards ── */
  .cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-bottom: 24px;
  }
  .card {
    background: var(--card);
    border-radius: 14px;
    padding: 20px 16px;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
    border: 1px solid var(--border);
    position: relative;
    overflow: hidden;
  }
  .card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    border-radius: 14px 14px 0 0;
  }
  .card.c-total::before { background: linear-gradient(90deg, #1E3A5F, #2563AB); }
  .card.c-pass::before  { background: linear-gradient(90deg, #16a34a, #4ade80); }
  .card.c-fail::before  { background: ${totalFailed > 0 ? 'linear-gradient(90deg,#dc2626,#f87171)' : 'linear-gradient(90deg,#94a3b8,#cbd5e1)'}; }
  .card.c-time::before  { background: linear-gradient(90deg, #7c3aed, #a78bfa); }

  .card .c-icon { font-size: 22px; margin-bottom: 8px; display: block; }
  .card .c-num  { font-size: 30px; font-weight: 800; line-height: 1; letter-spacing: -.5px; }
  .card .c-lbl  { font-size: 11px; color: var(--muted); margin-top: 5px;
                  letter-spacing: .06em; text-transform: uppercase; font-weight: 600; }
  .card.c-total .c-num { color: var(--primary); }
  .card.c-pass  .c-num { color: var(--pass); }
  .card.c-fail  .c-num { color: ${totalFailed > 0 ? 'var(--fail)' : 'var(--muted)'}; }
  .card.c-time  .c-num { color: var(--purple); font-size: 22px; }

  /* ── Progress bar ── */
  .progress-card {
    background: var(--card);
    border-radius: 14px;
    padding: 20px 24px;
    margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,.06);
    border: 1px solid var(--border);
  }
  .progress-top {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
  }
  .progress-top h3 { font-size: 13px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .progress-top .pct-badge {
    font-size: 13px; font-weight: 700;
    background: ${allPass ? 'var(--pass-bg)' : 'var(--fail-bg)'};
    color: ${allPass ? 'var(--pass)' : 'var(--fail)'};
    padding: 2px 10px; border-radius: 99px;
  }
  .bar-track { background: #e2e8f0; border-radius: 99px; height: 10px; overflow: hidden; }
  .bar-fill  {
    height: 100%; border-radius: 99px;
    background: ${allPass ? 'linear-gradient(90deg,#16a34a,#4ade80)' : 'linear-gradient(90deg,#dc2626,#f87171)'};
    width: ${passRate}%;
    transition: width .6s ease;
  }
  .bar-meta {
    display: flex; gap: 16px; margin-top: 10px; font-size: 12px; color: var(--muted);
  }
  .bar-meta span { display: flex; align-items: center; gap: 4px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .dot.pass { background: var(--pass); }
  .dot.fail { background: var(--fail); }
  .dot.time { background: var(--purple); }

  /* ── Section cards ── */
  .section {
    background: var(--card);
    border-radius: 14px;
    margin-bottom: 20px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04);
    border: 1px solid var(--border);
  }
  .section-head {
    padding: 16px 22px;
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid var(--border);
    background: #f8fafc;
  }
  .section-head-left { display: flex; align-items: center; gap: 12px; }
  .section-head-icon {
    width: 38px; height: 38px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; flex-shrink: 0;
  }
  .section-head-icon.jest { background: #fef3c7; }
  .section-head-icon.pw   { background: #ede9fe; }
  .section-head h2 { font-size: 15px; font-weight: 700; color: var(--primary); }
  .section-head .s-meta { font-size: 12px; color: var(--muted); margin-top: 1px; }

  /* ── Status badge ── */
  .sbadge { font-size: 12px; font-weight: 700; padding: 5px 12px;
            border-radius: 99px; white-space: nowrap; }
  .sbadge.pass { background: var(--pass-bg); color: var(--pass); border: 1px solid var(--pass-mid); }
  .sbadge.fail { background: var(--fail-bg); color: var(--fail); border: 1px solid #fca5a5; }
  .sbadge.none { background: #fef3c7;         color: #92400e;    border: 1px solid #fcd34d; }

  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #f8fafc; }
  th {
    padding: 10px 18px; text-align: left;
    font-size: 11px; text-transform: uppercase; letter-spacing: .07em;
    color: var(--muted); font-weight: 600; border-bottom: 1px solid var(--border);
  }
  td { padding: 11px 18px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #fafbfc; }

  td.tc  { text-align: center; }
  td.mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px;
            text-align: center; color: var(--muted); }
  td.suite-name { font-weight: 500; }

  .pass-num { color: var(--pass); font-weight: 700; }
  .fail-num { color: var(--fail); font-weight: 700; }
  .zero-num { color: #94a3b8; }

  /* Status dot in table */
  .row-status { display: inline-flex; align-items: center; gap: 8px; }
  .row-status .sdot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .row-status .sdot.p { background: var(--pass); }
  .row-status .sdot.f { background: var(--fail); }

  /* Totals row */
  tr.totals {
    background: linear-gradient(90deg, #f0f4f8, #f8fafc);
    border-top: 2px solid var(--border);
  }
  tr.totals td { font-weight: 700; border-bottom: none; color: var(--primary); }

  /* Error rows */
  tr.err-row td {
    background: #fff5f5; padding: 10px 18px 10px 42px;
    border-bottom: 1px solid #fee2e2;
  }
  tr.err-row .err-title { font-weight: 600; color: var(--fail); font-size: 12px; }
  tr.err-row code {
    display: block; margin-top: 4px; font-size: 11px; color: #7f1d1d;
    white-space: pre-wrap; word-break: break-all; opacity: .85;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .no-data { text-align: center; color: var(--muted); padding: 32px 16px; font-size: 13px; }

  /* ── Footer ── */
  .footer {
    text-align: center; font-size: 12px; color: var(--muted);
    margin-top: 32px; padding-top: 20px;
    border-top: 1px solid var(--border);
    display: flex; flex-direction: column; gap: 6px; align-items: center;
  }
  .footer-links { display: flex; gap: 16px; }
  .footer-links a { color: var(--accent); text-decoration: none; }
  .footer-links a:hover { text-decoration: underline; }
  .footer-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: ${allPass ? 'var(--pass-bg)' : 'var(--fail-bg)'};
    color: ${allPass ? 'var(--pass)' : 'var(--fail)'};
    padding: 4px 12px; border-radius: 99px; font-weight: 600; font-size: 12px;
  }
</style>
</head>
<body>

<!-- ── Page header ───────────────────────────────────────────────────────── -->
<div class="page-header">
  <div class="page-header-inner">
    <div>
      <div class="brand">
        <div class="brand-icon">🛡️</div>
        <div>
          <div class="brand-name">InsureDesk</div>
          <div class="brand-sub">Stage Test Report</div>
        </div>
      </div>
      <div class="header-date">📅 ${dateStr} &nbsp;·&nbsp; ⏰ ${timeStr}</div>
    </div>
    <div class="status-pill ${allPass ? 'pass' : 'fail'}">
      <div class="pill-icon">${allPass ? '✅' : '❌'}</div>
      <div class="pill-label">${allPass ? 'ALL PASSED' : 'FAILURES DETECTED'}</div>
      <div class="pill-count">${totalPassed} / ${totalTests} tests</div>
    </div>
  </div>
</div>

<div class="wrapper">

  <!-- ── Stat cards ── -->
  <div class="cards">
    <div class="card c-total">
      <span class="c-icon">🧪</span>
      <div class="c-num">${totalTests}</div>
      <div class="c-lbl">Total Tests</div>
    </div>
    <div class="card c-pass">
      <span class="c-icon">✅</span>
      <div class="c-num">${totalPassed}</div>
      <div class="c-lbl">Passed</div>
    </div>
    <div class="card c-fail">
      <span class="c-icon">${totalFailed > 0 ? '❌' : '🎯'}</span>
      <div class="c-num">${totalFailed}</div>
      <div class="c-lbl">Failed</div>
    </div>
    <div class="card c-time">
      <span class="c-icon">⏱️</span>
      <div class="c-num">${fmtMs(totalDuration)}</div>
      <div class="c-lbl">Total Duration</div>
    </div>
  </div>

  <!-- ── Pass rate ── -->
  <div class="progress-card">
    <div class="progress-top">
      <h3>Pass Rate</h3>
      <span class="pct-badge">${passRate}%</span>
    </div>
    <div class="bar-track"><div class="bar-fill"></div></div>
    <div class="bar-meta">
      <span><span class="dot pass"></span>${totalPassed} passed</span>
      <span><span class="dot fail"></span>${totalFailed} failed</span>
      <span><span class="dot time"></span>${fmtMs(totalDuration)} total run time</span>
    </div>
  </div>

  <!-- ── Backend API (Jest) ── -->
  <div class="section">
    <div class="section-head">
      <div class="section-head-left">
        <div class="section-head-icon jest">⚡</div>
        <div>
          <h2>Backend API Tests</h2>
          <div class="s-meta">${JEST_VERSION} &nbsp;·&nbsp; ${jestData.numTotalTests || 0} tests &nbsp;·&nbsp; ${fmtMs(jestTotalDurationMs)}</div>
        </div>
      </div>
      <span class="sbadge ${jestData.numTotalTests === 0 ? 'none' : jestData.numFailedTests > 0 ? 'fail' : 'pass'}">
        ${jestData.numTotalTests === 0 ? 'NO DATA' : jestData.numFailedTests > 0 ? '❌ ' + jestData.numFailedTests + ' failed' : '✅ ' + jestData.numPassedTests + ' / ' + jestData.numTotalTests + ' passed'}
      </span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:44%">Suite</th>
          <th class="tc">Tests</th>
          <th class="tc">Passed</th>
          <th class="tc">Failed</th>
          <th class="tc">Duration</th>
        </tr>
      </thead>
      <tbody>
        ${jestRows || `<tr><td colspan="5" class="no-data">⚠️ No Jest data found — ensure <code>--json</code> and <code>--outputFile</code> flags are used</td></tr>`}
        ${jestData.numTotalTests > 0 ? `
        <tr class="totals">
          <td>All Suites</td>
          <td class="tc">${jestData.numTotalTests}</td>
          <td class="tc pass-num">${jestData.numPassedTests}</td>
          <td class="tc ${jestData.numFailedTests > 0 ? 'fail-num' : 'zero-num'}">${jestData.numFailedTests || 0}</td>
          <td class="mono">${fmtMs(jestTotalDurationMs)}</td>
        </tr>` : ''}
      </tbody>
    </table>
  </div>

  <!-- ── E2E (Playwright) ── -->
  <div class="section">
    <div class="section-head">
      <div class="section-head-left">
        <div class="section-head-icon pw">🎭</div>
        <div>
          <h2>End-to-End Tests</h2>
          <div class="s-meta">Playwright &nbsp;·&nbsp; ${pwTotal} tests &nbsp;·&nbsp; ${fmtMs(pwTotalDurationMs)}</div>
        </div>
      </div>
      <span class="sbadge ${pwTotal === 0 ? 'none' : pwFailed > 0 ? 'fail' : 'pass'}">
        ${pwTotal === 0 ? 'NO DATA' : pwFailed > 0 ? '❌ ' + pwFailed + ' failed' : '✅ ' + pwPassed + ' / ' + pwTotal + ' passed'}
      </span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:44%">Spec File</th>
          <th class="tc">Tests</th>
          <th class="tc">Passed</th>
          <th class="tc">Failed</th>
          <th class="tc">Duration</th>
        </tr>
      </thead>
      <tbody>
        ${pwRows || `<tr><td colspan="5" class="no-data">⚠️ No Playwright data found — ensure <code>--reporter=json</code> is used</td></tr>`}
        ${pwTotal > 0 ? `
        <tr class="totals">
          <td>All Specs</td>
          <td class="tc">${pwTotal}</td>
          <td class="tc pass-num">${pwPassed}</td>
          <td class="tc ${pwFailed > 0 ? 'fail-num' : 'zero-num'}">${pwFailed || 0}</td>
          <td class="mono">${fmtMs(pwTotalDurationMs)}</td>
        </tr>` : ''}
      </tbody>
    </table>
  </div>

  ${covSection()}

  ${historyHTML(history)}

  <!-- ── Footer ── -->
  <div class="footer" style="margin-top:28px;">
    <span class="footer-badge">${allPass ? '✅ Stage Certified — Safe to Promote' : '❌ Stage Failed — Do Not Promote'}</span>
    <div class="footer-links">
      <a href="${STAGE_API_URL}">🚂 Railway Backend</a>
      <a href="${STAGE_BASE_URL}">▲ Vercel Frontend</a>
    </div>
    <span>Generated ${dateStr} &nbsp;·&nbsp; ${timeStr}</span>
  </div>

</div>
</body>
</html>`;

// ── Write output ──────────────────────────────────────────────────────────────
const outDir = path.dirname(outFile);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, html, 'utf8');
console.log(`HTML report written to: ${outFile}`);
console.log(`  Total: ${totalTests}  Passed: ${totalPassed}  Failed: ${totalFailed}  Duration: ${fmtMs(totalDuration)}`);
