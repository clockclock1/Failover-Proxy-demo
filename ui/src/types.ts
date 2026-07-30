export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  apiKeys: string[];
  apiKeyMode: 'single' | 'round-robin' | 'random';
  models: string[];
  status: 'online' | 'offline' | 'unknown';
  latency?: number;
  lastCheck?: number;
}

export interface FailoverModel {
  providerId: string;
  modelName: string;
  priority: number;
  weight: number;
  maxRetries: number;
  timeout: number;
  enabled: boolean;
}

export interface FailoverChain {
  id: string;
  name: string;
  description: string;
  models: FailoverModel[];
  strategy: 'priority' | 'round-robin' | 'weighted' | 'latency-based';
  proxyModelName: string;
  contextWindowTokens: number;
  proxyApiKey: string;
  targetTimeoutSeconds: number;
  targetMaxRetries: number;
  circuitFailureThreshold: number;
  circuitCooldownMinutes: number;
  rateLimitKeyCooldownSeconds: number;
  authKeyCooldownMinutes: number;
  enabled: boolean;
  createdAt: number;
  totalRequests: number;
  failoverCount: number;
  // `null` means the backend has not recorded a completed request yet.
  successRate: number | null;
}

export type Page = 'dashboard' | 'providers' | 'model-tests' | 'chains' | 'model-stats' | 'endpoints' | 'live-status' | 'circuit-breakers' | 'logs';

export interface ActiveCircuitBreaker {
  key: string;
  model: string;
  targetName: string;
  targetModel: string;
  targetBaseUrl: string;
  failures: number;
  disabledUntil: number;
  failureKind: 'authentication' | 'rate_limited' | 'compatibility' | 'transient' | 'other';
}

export interface ChannelModelStats {
  name: string;
  baseUrl: string;
  requests: number;
  successes: number;
  failures: number;
  models: Record<string, {
    name: string;
    requests: number;
    successes: number;
    failures: number;
    lastStatus: number;
    lastError: string;
    lastLatencyMs: number;
    updatedAt: number;
  }>;
}

export interface ActiveThread {
  id: string;
  slot: number;
  chainName: string;
  requestedModel: string;
  targetName: string;
  targetModel: string;
  targetBaseUrl: string;
  attempt: number;
  maxAttempts: number;
  compressionAttempt: number;
  maxCompressionAttempts: number;
  phase: string;
  status: string;
  startedAt: number;
  updatedAt: number;
  failedModels: string[];
  attemptErrors: Array<{
    target: string;
    attempt?: number;
    status?: number;
    message: string;
    detail?: string;
  }>;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  chainName: string;
  originalModel: string;
  failedModels: string[];
  failedModelErrors?: { model: string; error: string }[];
  finalModel: string;
  status: 'success' | 'failed';
  latency: number;
  error?: string;
}

export interface LogSettings {
  maxEntries: number;
  maxBytes: number;
  maxErrorChars: number;
}

export type ModelCapability = 'text' | 'vision' | 'tool';
export type ModelTestStatus = 'passed' | 'failed' | 'uncertain' | 'skipped';

export interface ModelTestTarget {
  id: string;
  providerId: string;
  providerName: string;
  baseUrl: string;
  apiKey: string;
  apiKeys?: string[];
  apiKeyMode?: Provider['apiKeyMode'];
  modelName: string;
}

export interface ModelCapabilityResult {
  capability: ModelCapability;
  status: ModelTestStatus;
  latencyMs?: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  detail: string;
  evidence?: string;
}

export interface ModelTestResult {
  id: string;
  providerId: string;
  providerName: string;
  baseUrl: string;
  modelName: string;
  startedAt: number;
  latencyMs: number;
  results: ModelCapabilityResult[];
}
