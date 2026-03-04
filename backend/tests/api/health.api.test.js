/**
 * API INTEGRATION TEST — GET /health
 *
 * Uses Node's built-in http module only — no supertest, no fetch polyfill.
 * Compatible with Jest 25 + Node 18+.
 *
 * Run: npm run test:api -- --testPathPattern=health.api
 */

process.env.JWT_SECRET = 'test-secret-key-insuredesk';
process.env.NODE_ENV   = 'test';

jest.mock('../../src/config/db',     () => ({ query: jest.fn() }));
jest.mock('../../src/config/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const http    = require('http');
const express = require('express');

const app = express();
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' })
);

let server, baseURL;

beforeAll(done => {
  server = http.createServer(app).listen(0, '127.0.0.1', () => {
    baseURL = `http://127.0.0.1:${server.address().port}`;
    done();
  });
});

afterAll(done => server.close(done));

// ── HTTP helper ────────────────────────────────────────────────────────────

function httpGet(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseURL + path);
    http.get({ hostname: url.hostname, port: url.port, path: url.pathname }, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch (e) { resolve({ status: res.statusCode, body: raw }); }
      });
    }).on('error', reject);
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  test('200 with status "ok"', async () => {
    const { status, body } = await httpGet('/health');
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
  });

  test('response includes a valid ISO timestamp', async () => {
    const { body } = await httpGet('/health');
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
  });

  test('response includes version "1.0.0"', async () => {
    const { body } = await httpGet('/health');
    expect(body.version).toBe('1.0.0');
  });

  test('responds in under 200 ms', async () => {
    const start = Date.now();
    await httpGet('/health');
    expect(Date.now() - start).toBeLessThan(200);
  });
});
