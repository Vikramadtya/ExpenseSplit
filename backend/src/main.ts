import './tracing';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { TracingInterceptor } from './common/interceptors/tracing.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind Render/Vercel proxies: use the real client IP for rate limiting.
  app.set('trust proxy', 1);
  app.use(helmet());
  configureApp(app);

  // Always use the clean console logger
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Conditionally enable verbose OpenTelemetry tracing via env var
  if (process.env.ENABLE_OPENTELEMETRY === 'true') {
    app.useGlobalInterceptors(new TracingInterceptor());
  }

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap().catch(console.error);
