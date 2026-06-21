import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { metrics } from '@opentelemetry/api';
import { monitorEventLoopDelay } from 'perf_hooks';

// Setup Event Loop Lag monitor via Node.js native perf_hooks
const eventLoopMonitor = monitorEventLoopDelay({ resolution: 10 });
eventLoopMonitor.enable();

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
    }),
    exportIntervalMillis: 60000,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

const meter = metrics.getMeter('gamehub-manual-metrics');

// 1. Node.js Event Loop Lag Gauge
const eventLoopLagGauge = meter.createObservableGauge('nodejs_eventloop_lag_seconds', {
  description: 'Measures Node.js Event Loop Lag in seconds',
  unit: 's',
});

eventLoopLagGauge.addCallback((observableResult) => {
  // convert nanoseconds to seconds
  const meanDelaySeconds = eventLoopMonitor.mean / 1e9;
  observableResult.observe(meanDelaySeconds);
  eventLoopMonitor.reset();
});

// 2. Redis Command Execution Latency Histogram
export const redisCommandLatency = meter.createHistogram('redis_command_latency_seconds', {
  description: 'Measures Redis command execution latency in seconds',
  unit: 's',
});

// 3. PostgreSQL/TypeORM Connection Pool Utilization Gauge
let activeConnections = 0;
export const dbConnectionPoolGauge = meter.createObservableGauge('db_pool_active_connections', {
  description: 'Measures PostgreSQL/TypeORM active database connection pool utilization',
});

dbConnectionPoolGauge.addCallback((observableResult) => {
  observableResult.observe(activeConnections);
});

export function updateActiveDbConnections(count: number) {
  activeConnections = count;
}

process.on('SIGTERM', () => {
  eventLoopMonitor.disable();
  sdk.shutdown()
    .then(() => console.log('OTel SDK shut down successfully'))
    .catch((error) => console.log('Error shutting down OTel SDK', error))
    .finally(() => process.exit(0));
});
