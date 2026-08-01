import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { authenticateAndAuthorizeTenant } from './auth-middleware.js';
import { config } from './config.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origem não autorizada pelo CORS.'));
    },
    credentials: false,
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Tenant-ID'],
    exposedHeaders: ['Content-Disposition'],
  }),
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(authenticateAndAuthorizeTenant);

app.use(
  createProxyMiddleware({
    target: config.springBackendUrl,
    changeOrigin: true,
    proxyTimeout: config.proxyTimeoutMs,
    timeout: config.proxyTimeoutMs,
    xfwd: true,
    on: {
      proxyReq(proxyReq, req) {
        if (config.upstreamAuthMode === 'none') {
          proxyReq.removeHeader('authorization');
        } else if (config.upstreamAuthMode === 'service-token') {
          proxyReq.setHeader('authorization', `Bearer ${config.upstreamServiceToken}`);
        } else if (req.firebaseToken) {
          proxyReq.setHeader('authorization', `Bearer ${req.firebaseToken}`);
        }
      },
      error(error, _req, res) {
        if ('headersSent' in res && !res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
        }
        if ('end' in res) {
          res.end(
            JSON.stringify({
              error: 'bad_gateway',
              message: 'Não foi possível acessar o backend Spring.',
            }),
          );
        }
        console.error('Falha no proxy para o Spring:', error.message);
      },
    },
  }),
);

app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(500).json({ error: 'gateway_error', message: error.message });
  },
);

app.listen(config.port, () => {
  console.log(`Gateway Firebase ouvindo na porta ${config.port}.`);
  console.log(`Backend Spring: ${config.springBackendUrl}`);
});
