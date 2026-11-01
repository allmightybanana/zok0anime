import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { streamRouter } from './routes/stream.js';
import { proxyRouter } from './routes/proxy.js';
import { defaultCache } from './cache.js';
import { openApiSpec } from './swagger.js';

export function createApp() {
  const app = express();

  // Basic security & parsing
  app.set('trust proxy', true);
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Normalize Netlify function path prefix if invoked directly or rewritten with prefix
  app.use((req, res, next) => {
    if (req.url.startsWith('/.netlify/functions/api')) {
      req.url = req.url.slice('/.netlify/functions/api'.length) || '/';
    } else if (req.url.startsWith('/.netlify/functions/')) {
      const parts = req.url.split('/');
      req.url = '/' + parts.slice(4).join('/') || '/';
    }
    if (!req.url.startsWith('/')) {
      req.url = '/' + req.url;
    }
    next();
  });

  // Swagger Documentation configuration with CDN fallback for serverless compatibility
  const swaggerUiOptions = {
    customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js'
    ],
    customSiteTitle: 'ZokoAnime Scraper API Docs'
  };

  // Root / Welcome endpoint
  app.get('/', (req, res) => {
    res.json({
      service: 'zokoanime-scraper',
      status: 'ok',
      version: '1.0.0',
      description: 'ZokoAnime Scraper & Direct M3U8 API',
      documentation: '/docs',
      health: '/health',
      endpoints: {
        stream: '/api/stream',
        proxy: '/api/proxy/stream',
        cacheStats: '/api/cache/stats',
        docs: '/docs',
        health: '/health'
      }
    });
  });

  // Swagger Documentation
  app.get('/openapi.json', (req, res) => res.json(openApiSpec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerUiOptions));

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'zokoanime-scraper',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      cache: defaultCache.getStats()
    });
  });

  // Cache management
  app.get('/api/cache/stats', (req, res) => {
    res.json({
      success: true,
      data: defaultCache.getStats()
    });
  });

  app.post('/api/cache/clear', (req, res) => {
    defaultCache.clear();
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  });

  // Mount API routers
  app.use('/api/proxy', proxyRouter);
  app.use('/api', streamRouter);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${req.method} ${req.originalUrl} not found`
      }
    });
  });

  // Global error handler
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected error occurred'
      }
    });
  });

  return app;
}
