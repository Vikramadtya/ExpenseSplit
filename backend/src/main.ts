import './tracing';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TracingInterceptor } from './common/interceptors/tracing.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS since frontend is on a different port
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  // Always use the clean console logger
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Conditionally enable verbose OpenTelemetry tracing via env var
  if (process.env.ENABLE_OPENTELEMETRY === 'true') {
    app.useGlobalInterceptors(new TracingInterceptor());
  }

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
