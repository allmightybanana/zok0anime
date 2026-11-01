import dotenv from 'dotenv';
import serverless from 'serverless-http';
import { createApp } from '../../src/app.js';
import { initProxyAgent } from '../../src/proxy-agent.js';

dotenv.config();
initProxyAgent();

const app = createApp();

export const handler = serverless(app, {
  binary: [
    'video/*',
    'image/*',
    'application/octet-stream',
    'application/vnd.apple.mpegurl',
    'application/x-mpegURL'
  ],
  request: (req, event, context) => {
    // Normalize Netlify paths when invoked directly or via internal redirection
    if (req.url && req.url.startsWith('/.netlify/functions/api')) {
      let cleaned = req.url.slice('/.netlify/functions/api'.length) || '/';
      if (!cleaned.startsWith('/')) {
        cleaned = '/' + cleaned;
      }
      req.url = cleaned;
    }
  }
});
