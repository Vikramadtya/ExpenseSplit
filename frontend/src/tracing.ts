import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';

const isEnabled = import.meta.env.VITE_ENABLE_OPENTELEMETRY === 'true';
const otlpEndpoint = import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT;

if (isEnabled) {
  const provider = new WebTracerProvider();

  if (otlpEndpoint) {
    const exporter = new OTLPTraceExporter({
      url: otlpEndpoint,
      headers: import.meta.env.VITE_OTEL_EXPORTER_OTLP_HEADERS
        ? Object.fromEntries(
            import.meta.env.VITE_OTEL_EXPORTER_OTLP_HEADERS.split(',').map((h: string) =>
              h.split('='),
            ),
          )
        : {},
    });
    // @ts-expect-error provider typings lag the SDK
    provider.addSpanProcessor(new BatchSpanProcessor(exporter));
    console.log('[OpenTelemetry Web] Tracing enabled, exporting to', otlpEndpoint);
  } else {
    console.log('[OpenTelemetry Web] No endpoint provided. Tracing enabled but not exporting.');
  }

  // Use ZoneContextManager for async context tracking in the browser
  provider.register({
    contextManager: new ZoneContextManager(),
  });

  registerInstrumentations({
    instrumentations: [
      // Automatically trace user clicks and interactions
      new UserInteractionInstrumentation({
        eventNames: ['click', 'submit'],
      }),
      // Trace standard fetch requests
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [new RegExp(import.meta.env.VITE_API_BASE_URL || '.*')],
      }),
      // Trace Axios requests (which use XHR under the hood in older versions / by default)
      new XMLHttpRequestInstrumentation({
        propagateTraceHeaderCorsUrls: [new RegExp(import.meta.env.VITE_API_BASE_URL || '.*')],
      }),
    ],
  });
}
