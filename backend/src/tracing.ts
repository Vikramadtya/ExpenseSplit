import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import * as dotenv from 'dotenv';

// Load .env if present so tracing can start before NestJS loads ConfigModule
dotenv.config();

const isEnabled = process.env.ENABLE_OPENTELEMETRY === 'true';
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
// The SDK automatically picks up OTEL_SERVICE_NAME from the environment

// Graceful fallback: If OTLP endpoint is provided, use it, else default to Console (or Noop)
const traceExporter = otlpEndpoint
  ? new OTLPTraceExporter({ url: otlpEndpoint })
  : new ConsoleSpanExporter();

const sdk = new NodeSDK({
  traceExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable noisy instrumentations if needed
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-net': { enabled: false },
    }),
  ],
});

if (isEnabled) {
  sdk.start();
  console.log(`[OpenTelemetry] Tracing initialized`);
  if (otlpEndpoint) {
    console.log(`[OpenTelemetry] Exporting traces to OTLP endpoint: ${otlpEndpoint}`);
  } else {
    console.log(`[OpenTelemetry] No OTEL_EXPORTER_OTLP_ENDPOINT provided. Exporting to Console.`);
  }
} else {
  console.log(`[OpenTelemetry] Tracing disabled (ENABLE_OPENTELEMETRY is not true).`);
}

process.on('SIGTERM', () => {
  if (isEnabled) {
    sdk
      .shutdown()
      .then(() => console.log('[OpenTelemetry] Tracing terminated gracefully'))
      .catch((error) => console.log('[OpenTelemetry] Error terminating tracing', error))
      .finally(() => process.exit(0));
  }
});
