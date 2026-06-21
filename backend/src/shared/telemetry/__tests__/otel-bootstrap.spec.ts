import { NodeSDK } from '@opentelemetry/sdk-node';

// Mock OpenTelemetry modules
jest.mock('@opentelemetry/sdk-node', () => {
  const mockStart = jest.fn();
  const mockShutdown = jest.fn().mockResolvedValue(undefined);
  return {
    NodeSDK: jest.fn().mockImplementation(() => {
      return {
        start: mockStart,
        shutdown: mockShutdown,
      };
    }),
  };
});

jest.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: jest.fn().mockReturnValue([]),
}));

jest.mock('@opentelemetry/exporter-trace-otlp-grpc', () => ({
  OTLPTraceExporter: jest.fn(),
}));

jest.mock('@opentelemetry/exporter-metrics-otlp-grpc', () => ({
  OTLPMetricExporter: jest.fn(),
}));

jest.mock('@opentelemetry/sdk-metrics', () => ({
  PeriodicExportingMetricReader: jest.fn(),
}));

describe('OpenTelemetry Bootstrap Unit Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize NodeSDK with default configurations without throwing', async () => {
    // Set custom environmental variable
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4317';

    // Import the bootstrap file to trigger execution
    await import('../otel-bootstrap');

    // Verify NodeSDK was instantiated
    expect(NodeSDK).toHaveBeenCalled();

    // Verify start was called on the SDK instance
    const mockSdkInstance = (NodeSDK as jest.Mock).mock.results[0].value;
    expect(mockSdkInstance.start).toHaveBeenCalled();
  });
});
