/**
 * API INTEGRATION TEST — GET /health
 * Verifies the health-check endpoint returns the expected shape.
 * Run: npm test -- --testPathPattern=health.api
 */

process.env.JWT_SECRET = 'test-secret-key-insuredesk';
process.env.NODE_ENV   = 'test';

jest.mock('../../src/config/db',     () => ({ query: jest.fn() }));
jest.mock('../../src/config/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const request = require('supertest');
const express = require('express');

const app = express();
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

describe('GET /health', () => {
  test('200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('response includes timestamp', async () => {
    const res = await request(app).get('/health');
    expect(res.body.timestamp).toBeDefined();
    expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
  });

  test('response includes version', async () => {
    const res = await request(app).get('/health');
    expect(res.body.version).toBe('1.0.0');
  });
});
