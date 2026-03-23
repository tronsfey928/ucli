/**
 * OpenTelemetry SDK bootstrap.
 *
 * MUST be imported at the very top of main.ts — before reflect-metadata and
 * NestJS — so that auto-instrumentation patches are applied first.
 *
 * Tracing is enabled by default (OTEL_ENABLED defaults to true).
 * Spans are exported via OTLP HTTP when OTEL_EXPORTER_OTLP_ENDPOINT is set;
 * otherwise they are silently discarded (no-op exporter).
 *
 * This module is intentionally independent of NestJS DI — it reads env vars
 * directly from process.env so it can run before the NestJS container starts.
 *
 * Standard OTEL env vars honoured:
 *   OTEL_SERVICE_NAME              — service name (default: "oas-server")
 *   OTEL_EXPORTER_OTLP_ENDPOINT    — collector endpoint, e.g. http://otel-collector:4318
 *   OTEL_EXPORTER_OTLP_HEADERS     — optional auth headers (e.g. "Authorization=Bearer token")
 *   OTEL_PROPAGATORS               — propagator list (default: tracecontext,baggage)
 *   OTEL_TRACES_SAMPLER            — sampler (default: parentbased_always_on)
 *
 * Custom env vars:
 *   OTEL_ENABLED                   — set to "false" to disable entirely (default: "true")
 */

import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

const enabled = process.env.OTEL_ENABLED !== 'false'

if (enabled) {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'ucli-server',
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? 'unknown',
  })

  // Only create the OTLP exporter when an endpoint is explicitly configured.
  // Without an endpoint the SDK uses a no-op exporter: instrumentation is
  // active (context propagation works) but spans are discarded locally.
  const sdkConfig: ConstructorParameters<typeof NodeSDK>[0] = {
    resource,
    instrumentations: [
      getNodeAutoInstrumentations({
        // fs instrumentation generates very high-cardinality noise
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  }

  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    sdkConfig.traceExporter = new OTLPTraceExporter()
  }

  const sdk = new NodeSDK(sdkConfig)

  sdk.start()

  // Flush pending spans on graceful shutdown
  process.on('SIGTERM', () => {
    void sdk.shutdown().catch((err: unknown) => {
      console.error('[OTel] Error during SDK shutdown:', err)
    })
  })
}
