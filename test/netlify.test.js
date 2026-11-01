import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../netlify/functions/api.js';

describe('Netlify Functions Handler', () => {
  test('GET / returns 200 and service metadata', async () => {
    const res = await handler(
      {
        httpMethod: 'GET',
        path: '/',
        headers: {}
      },
      {}
    );

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'zokoanime-scraper');
    assert.equal(body.documentation, '/docs');
  });

  test('GET /health returns 200 ok', async () => {
    const res = await handler(
      {
        httpMethod: 'GET',
        path: '/health',
        headers: {}
      },
      {}
    );

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'zokoanime-scraper');
  });

  test('GET /.netlify/functions/api/health normalizes path and returns 200', async () => {
    const res = await handler(
      {
        httpMethod: 'GET',
        path: '/.netlify/functions/api/health',
        headers: {}
      },
      {}
    );

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'ok');
  });

  test('GET /.netlify/functions/api/api/stream without params returns 400', async () => {
    const res = await handler(
      {
        httpMethod: 'GET',
        path: '/.netlify/functions/api/api/stream',
        headers: {}
      },
      {}
    );

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'MISSING_PARAM');
  });

  test('GET /openapi.json returns 200 with OpenAPI spec', async () => {
    const res = await handler(
      {
        httpMethod: 'GET',
        path: '/openapi.json',
        headers: {}
      },
      {}
    );

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.openapi, '3.0.3');
  });

  test('GET /docs/ returns Swagger UI HTML with CDN assets', async () => {
    const res = await handler(
      {
        httpMethod: 'GET',
        path: '/docs/',
        headers: {}
      },
      {}
    );

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.includes('swagger-ui'));
    assert.ok(res.body.includes('cdnjs.cloudflare.com'));
  });
});
