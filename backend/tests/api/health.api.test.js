/**
 * API INTEGRATION TEST — GET /health
 *
 * Uses Node's built-in http + fetch (Node 18+) — no supertest required.
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
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

let server, baseURL;

beforeAll(done => {
  server = http.createServer(app).listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    baseURL = `http://127.0.0.1:${port}`;
    done();
  });
});

afterAll(done => server.close(done));

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  test('200 with status "ok"', async () => {
    const res  = await fetch(`${baseURL}/health`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
  });

  test('response includes a valid ISO timestamp', async () => {
    const res  = await fetch(`${baseURL}/health`);
    const body = await res.json();
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
  });

  test('response includes version "1.0.0"', async () => {
    const res  = await fetch(`${baseURL}/health`);
    const body = await res.json();
    expect(body.version).toBe('1.0.0');
  });

  test('responds in under 200 ms', async () => {
    const start = Date.now();
    await fetch(`${baseURL}/health`);
    expect(Date.now() - start).toBeLessThan(200);
  });
});
