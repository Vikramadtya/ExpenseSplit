import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  traceExporter: new ConsoleSpanExporter(), // Replace with proper exporter in production (e.g. OTLP)
  instrumentations: [getNodeAutoInstrumentations()],
});

if (process.env.ENABLE_OPENTELEMETRY === 'true') {
  sdk.start();
}

process.on('SIGTERM', () => {
  if (process.env.ENABLE_OPENTELEMETRY === 'true') {
    sdk
      .shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch((error) => console.log('Error terminating tracing', error))
      .finally(() => process.exit(0));
  }
});
