import { ProxyAgent, fetch as undiciFetch } from 'undici';

let proxyAgentInstance = null;

/**
 * Checks whether a given URL is a local/loopback address.
 * Local requests must never be routed through an external proxy.
 * @param {string} urlStr
 * @returns {boolean}
 */
export function isLocalhost(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    );
  } catch {
    return false;
  }
}

/**
 * Mask credentials in a proxy URL for safe logging.
 * @param {string} urlStr
 * @returns {string}
 */
export function sanitizeProxyUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.username || parsed.password) {
      parsed.username = '***';
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return urlStr.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@');
  }
}

/**
 * Initializes the upstream ProxyAgent instance.
 * @param {string} [proxyUrl] Proxy URL (e.g., http://user:pass@host:port)
 * @returns {ProxyAgent | null}
 */
export function initProxyAgent(
  proxyUrl = process.env.UPSTREAM_PROXY || process.env.HTTP_PROXY
) {
  if (!proxyUrl || typeof proxyUrl !== 'string' || !proxyUrl.trim()) {
    proxyAgentInstance = null;
    return null;
  }

  const cleanUrl = proxyUrl.trim();
  try {
    proxyAgentInstance = new ProxyAgent(cleanUrl);
    const sanitized = sanitizeProxyUrl(cleanUrl);
    console.log(`🔒 Upstream proxy enabled: ${sanitized}`);
    return proxyAgentInstance;
  } catch (err) {
    console.error('Failed to initialize upstream proxy:', err.message);
    proxyAgentInstance = null;
    return null;
  }
}

/**
 * Universal fetch that routes external requests through the upstream ProxyAgent
 * while keeping localhost/local requests direct.
 * 
 * @param {string | URL | Request} url
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export async function proxyFetch(url, init = {}) {
  const urlStr = typeof url === 'string' ? url : url?.href || String(url);
  const useProxy = proxyAgentInstance && !isLocalhost(urlStr);

  if (useProxy) {
    return undiciFetch(url, {
      ...init,
      dispatcher: proxyAgentInstance,
    });
  }

  return fetch(url, init);
}

/**
 * Returns the active ProxyAgent instance, if any.
 * @returns {ProxyAgent | null}
 */
export function getProxyAgent() {
  return proxyAgentInstance;
}

/**
 * Manually sets or resets the active ProxyAgent instance (useful for testing).
 * @param {ProxyAgent | null} [agent=null]
 */
export function setProxyAgent(agent = null) {
  proxyAgentInstance = agent;
}
