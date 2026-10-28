import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLocalhost,
  sanitizeProxyUrl,
  initProxyAgent,
  proxyFetch,
  getProxyAgent,
  setProxyAgent
} from '../src/proxy-agent.js';

describe('Proxy Agent Utilities', () => {
  beforeEach(() => {
    setProxyAgent(null);
  });

  test('isLocalhost identifies loopback and local hostnames', () => {
    assert.equal(isLocalhost('http://localhost:3000'), true);
    assert.equal(isLocalhost('http://127.0.0.1:8080/path'), true);
    assert.equal(isLocalhost('http://0.0.0.0:3000'), true);
    assert.equal(isLocalhost('http://[::1]:3000'), true);
    assert.equal(isLocalhost('http://service.internal/api'), true);
    assert.equal(isLocalhost('http://myhost.local:5000'), true);
  });

  test('isLocalhost returns false for external hostnames', () => {
    assert.equal(isLocalhost('https://zokoanime.video/stream'), false);
    assert.equal(isLocalhost('https://example.com'), false);
    assert.equal(isLocalhost('https://198.51.100.1:8080'), false);
    assert.equal(isLocalhost('not-a-valid-url'), false);
  });

  test('sanitizeProxyUrl masks credentials safely', () => {
    const raw = 'http://user:secretpass@1.2.3.4:8080';
    const sanitized = sanitizeProxyUrl(raw);
    assert.ok(!sanitized.includes('secretpass'));
    assert.ok(!sanitized.includes('user'));
    assert.ok(sanitized.includes('***:***@1.2.3.4:8080'));
  });

  test('sanitizeProxyUrl leaves unauthenticated URLs intact', () => {
    const raw = 'http://1.2.3.4:8080';
    const sanitized = sanitizeProxyUrl(raw);
    assert.equal(sanitized, 'http://1.2.3.4:8080/');
  });

  test('initProxyAgent returns null when proxyUrl is empty or falsy', () => {
    const agent = initProxyAgent('');
    assert.equal(agent, null);
    assert.equal(getProxyAgent(), null);
  });

  test('initProxyAgent initializes ProxyAgent for valid URL', () => {
    const agent = initProxyAgent('http://testproxy:8080');
    assert.ok(agent);
    assert.equal(getProxyAgent(), agent);
  });

  test('proxyFetch falls back to direct fetch when no proxy agent is configured', async () => {
    setProxyAgent(null);
    // Fetch a non-existent port on localhost to ensure direct fetch is invoked (rejects connection refused)
    await assert.rejects(
      () => proxyFetch('http://127.0.0.1:59999'),
      /ECONNREFUSED|fetch failed/
    );
  });
});
