import type { NestExpressApplication } from '@nestjs/platform-express';

/** Headers the web app sends. A header missing here makes the browser block the whole request. */
export const ALLOWED_REQUEST_HEADERS = [
  'Content-Type',
  'Authorization',
  'Idempotency-Key',
  'X-Request-Id',
  'traceparent',
  'tracestate',
];

/** Settings the real server and the integration tests must share. */
export function configureApp(app: NestExpressApplication) {
  // The frontend is served from another origin.
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    exposedHeaders: ['x-next-cursor'],
    allowedHeaders: ALLOWED_REQUEST_HEADERS,
  });

  // Splitwise exports arrive as plain text.
  app.useBodyParser('text', { type: 'text/csv', limit: '2mb' });

  // Receipt photos are uploaded as raw bytes (no multipart parsing, nothing buffered twice).
  app.useBodyParser('raw', { type: ['image/jpeg', 'image/png', 'image/webp'], limit: '8mb' });
}
