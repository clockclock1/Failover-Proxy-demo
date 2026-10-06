import React, { createContext, useContext, useCallback, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Provider, FailoverChain, Page, LogEntry, ActiveThread, ActiveCircuitBreaker, ModelCapability, ModelTestResult, ModelTestTarget, ChannelModelStats, LogSettings } from './types';

interface BackendTarget {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  apiKeys?: string[];
  apiKeyMode?: Provider['apiKeyMode'];
  modelName?: string;
  modelNameTemplate?: string;
  enabled?: boolean;
  timeoutMs?: number;
  priority?: number;
  weight?: number;
  maxRetries?: number;
}

interface BackendModel {
  publicName: string;
  contextWindowTokens?: number;
  enabled?: boolean;
  strategy?: FailoverChain['strategy'];
  circuitBreaker?: {
    failureThreshold?: number;
    cooldownMinutes?: number;
  };
  targets?: BackendTarget[];
}

interface BackendProvider {
  id?: string;
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  apiKeys?: string[];
  apiKeyMode?: Provider['apiKeyMode'];
  models?: string[];
}

interface BackendConfig {
  adminToken: string;
  proxyKeys: { name?: string; key: string; enabled?: boolean }[];
  failoverStatusCodes: number[];
  requestTimeoutMs: number;
  logSettings?: LogSettings;
  passThroughRequestEnabled?: boolean;
  chatCompletionsToResponsesPolicy?: {
    enabled: boolean;
    allTargets: boolean;
    targetNames: string[];
    modelPatterns: string[];
  };
  responsesToChatCompletionsPolicy?: {
    enabled: boolean;
    allTargets: boolean;
    targetNames: string[];
    modelPatterns: string[];
  };
  circuitBreaker?: {
    failureThreshold?: number;
    cooldownMinutes?: number;
  };
  modelSource?: unknown;
  providers?: BackendProvider[];
  models: BackendModel[];
}

interface BackendStats {
  startedAt?: string;
  requests?: number;
  successes?: number;
  failures?: number;
  failovers?: number;
  memory?: {
    platform?: string;
    pid?: number;
    primaryMetric?: string;
    primaryMetricLabel?: string;
    workingSetBytes?: number;
    peakWorkingSetBytes?: number;
    privateCommitBytes?: number;
    physicalFootprintBytes?: number;
    rssBytes?: number;
    pssBytes?: number;
    privateResidentBytes?: number;
    peakRssBytes?: number;
    swapBytes?: number;
    virtualBytes?: number;
    dataBytes?: number;
    collectionError?: string | null;
  };
  runtimeStateMemory?: Record<string, {
    entries?: number;
    estimatedBytes?: number;
  } | string>;
  chains?: Record<string, {
    requests: number;
    successes: number;
    failures: number;
    failovers: number;
  }>;
  channelModels?: Record<string, ChannelModelStats>;
  logs?: Array<{
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
  }>;
  activeThreads?: ActiveThread[];
  circuitBreakers?: ActiveCircuitBreaker[];
  logSettings?: LogSettings;
  logsPath?: string;
  modelStatsPath?: string;
}

interface State {
  currentPage: Page;
  providers: Provider[];
  chains: FailoverChain[];
  logs: LogEntry[];
  activeThreads: ActiveThread[];
  sidebarCollapsed: boolean;
  adminToken: string;
  adminSession: string;
  authenticated: boolean;
  authChecked: boolean;
  configLoaded: boolean;
  pageStatsLoading: boolean;
  statsRefreshNonce: number;
  saveStatus: 'idle' | 'loading' | 'saving' | 'saved' | 'error';
  saveError: string;
  hasUnsavedChanges: boolean;
  backendConfig: BackendConfig | null;
  backendStats: BackendStats | null;
}

type Action =
  | { type: 'SET_PAGE'; page: Page }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_ADMIN_TOKEN'; token: string }
  | { type: 'SET_ADMIN_SESSION'; session: string }
  | { type: 'CLEAR_AUTH' }
  | { type: 'SET_AUTH_CHECKED'; checked: boolean }
  | { type: 'SET_SAVE_STATUS'; status: State['saveStatus']; error?: string }
  | { type: 'SET_PAGE_STATS_LOADING'; page: Page; loading: boolean }
  | { type: 'LOAD_BACKEND_STATE'; config: BackendConfig; stats?: BackendStats | null }
  | { type: 'LOAD_BACKEND_STATS'; stats: BackendStats; page?: Page }
  | { type: 'ADD_PROVIDER'; provider: Provider }
  | { type: 'UPDATE_PROVIDER'; provider: Provider }
  | { type: 'DELETE_PROVIDER'; id: string }
  | { type: 'SET_PROVIDER_MODELS'; id: string; models: string[] }
  | { type: 'SET_PROVIDER_STATUS'; id: string; status: Provider['status']; latency?: number }
  | { type: 'SET_PROVIDER_HEALTHS'; providers: Array<{ id?: string; name?: string; baseUrl: string; status: Provider['status']; latency?: number; models?: string[]; error?: string }> }
  | { type: 'ADD_CHAIN'; chain: FailoverChain }
  | { type: 'UPDATE_CHAIN'; chain: FailoverChain }
  | { type: 'DELETE_CHAIN'; id: string }
  | { type: 'SYNC_CHAIN_MODELS'; id: string }
  | { type: 'UPDATE_PROTOCOL_POLICY'; direction: 'chatToResponses' | 'responsesToChat'; policy: { enabled: boolean; allTargets: boolean; targetNames: string[]; modelPatterns: string[] } }
  | { type: 'SET_REQUEST_PASSTHROUGH'; enabled: boolean }
  | { type: 'ADD_LOG'; log: LogEntry }
  | { type: 'SET_LOG_SETTINGS'; settings: LogSettings };

const defaultConfig: BackendConfig = {
  adminToken: 'admin',
  proxyKeys: [{ name: 'test-key', key: 'sk-local-test', enabled: true }],
  failoverStatusCodes: [401, 403, 408, 409, 429, 500, 502, 503, 504],
  requestTimeoutMs: 120000,
  passThroughRequestEnabled: false,
  chatCompletionsToResponsesPolicy: {
    enabled: false,
    allTargets: true,
    targetNames: [],
    modelPatterns: [],
  },
  responsesToChatCompletionsPolicy: {
    enabled: false,
    allTargets: true,
    targetNames: [],
    modelPatterns: [],
  },
  logSettings: {
    maxEntries: 500,
    maxBytes: 10 * 1024 * 1024,
    maxErrorChars: 65536,
  },
  circuitBreaker: {
    failureThreshold: 3,
    cooldownMinutes: 10,
  },
  modelSource: {
    enabled: false,
    url: '',
    apiKey: '',
    refreshSeconds: 300,
    contextWindowTokens: 1_000_000,
    include: '',
    exclude: '',
    publicPrefix: '',
    publicSuffix: '',
    targets: [],
  },
  providers: [],
  models: [],
};

const ADMIN_SESSION_KEY = 'adminSession';

function getStoredAdminSession() {
  if (typeof window === 'undefined') return '';
  const localSession = window.localStorage.getItem(ADMIN_SESSION_KEY) || '';
  const legacySession = window.sessionStorage.getItem(ADMIN_SESSION_KEY) || '';
  if (!localSession && legacySession) {
    window.localStorage.setItem(ADMIN_SESSION_KEY, legacySession);
  }
  return localSession || legacySession;
}

function setStoredAdminSession(session: string) {
  window.localStorage.setItem(ADMIN_SESSION_KEY, session);
  window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

function clearStoredAdminSession() {
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
  window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

const initialState: State = {
  currentPage: 'dashboard',
  sidebarCollapsed: false,
  providers: [],
  chains: [],
  logs: [],
  activeThreads: [],
  adminToken: '',
  adminSession: getStoredAdminSession(),
  authenticated: false,
  authChecked: false,
  configLoaded: false,
  pageStatsLoading: true,
  statsRefreshNonce: 0,
  saveStatus: 'idle',
  saveError: '',
  hasUnsavedChanges: false,
  backendConfig: null,
  backendStats: null,
};

function normalizeChainModels(models: FailoverChain['models']) {
  return [...models]
    .sort((a, b) => a.priority - b.priority)
    .map((model, index) => ({
      ...model,
      priority: index + 1,
      weight: 1,
      maxRetries: Math.max(0, Math.floor(Number(model.maxRetries) || 0)),
      timeout: Math.max(1, Math.floor(Number(model.timeout) || 30)),
      enabled: model.enabled !== false,
    }));
}

function normalizeChain(chain: FailoverChain): FailoverChain {
  const models = normalizeChainModels(chain.models || []);
  const firstModel = models[0];
  return {
    ...chain,
    strategy: chain.strategy === 'weighted' ? 'priority' : chain.strategy || 'priority',
    contextWindowTokens: Math.max(1024, Math.floor(Number(chain.contextWindowTokens) || 1_000_000)),
    targetTimeoutSeconds: Math.max(1, Math.floor(Number(chain.targetTimeoutSeconds || firstModel?.timeout) || 30)),
    targetMaxRetries: Math.max(0, Math.floor(Number(chain.targetMaxRetries ?? firstModel?.maxRetries) || 0)),
    circuitFailureThreshold: Math.max(1, Math.floor(Number(chain.circuitFailureThreshold) || 3)),
    circuitCooldownMinutes: Math.max(1, Math.floor(Number(chain.circuitCooldownMinutes) || 10)),
    models,
  };
}

function synchronizeChainModelsWithProviders(chains: FailoverChain[], providers: Provider[]) {
  const selectedModelsByProvider = new Map(
    providers.map(provider => [provider.id, new Set(uniqueStrings(provider.models || []))])
  );
  return chains.map(chain => ({
    ...chain,
    models: normalizeChainModels(chain.models.filter(model => {
      const selectedModels = selectedModelsByProvider.get(model.providerId);
      return !selectedModels || selectedModels.has(model.modelName);
    })),
  }));
}

function markConfigChanged(state: State, updates: Partial<State>): State {
  return {
    ...state,
    ...updates,
    hasUnsavedChanges: true,
    saveStatus: state.saveStatus === 'loading' || state.saveStatus === 'saving' ? state.saveStatus : 'idle',
    saveError: '',
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PAGE': {
      const hasPageStats = Boolean(pageStatsPath(action.page));
      if (state.currentPage === action.page) {
        if (!state.configLoaded || !hasPageStats) return state;
        return {
          ...state,
          pageStatsLoading: true,
          statsRefreshNonce: state.statsRefreshNonce + 1,
        };
      }
      return {
        ...state,
        currentPage: action.page,
        pageStatsLoading: state.configLoaded && hasPageStats,
        statsRefreshNonce: state.statsRefreshNonce + 1,
      };
    }
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    case 'SET_ADMIN_TOKEN':
      return { ...state, adminToken: action.token };
    case 'SET_ADMIN_SESSION':
      setStoredAdminSession(action.session);
      return { ...state, adminSession: action.session, authenticated: false, authChecked: true };
    case 'CLEAR_AUTH':
      clearStoredAdminSession();
      return {
        ...state,
        adminSession: '',
        authenticated: false,
        authChecked: true,
        configLoaded: false,
        pageStatsLoading: false,
        statsRefreshNonce: 0,
        backendConfig: null,
        backendStats: null,
        providers: [],
        chains: [],
        logs: [],
        activeThreads: [],
        saveStatus: 'idle',
        saveError: '',
        hasUnsavedChanges: false,
      };
    case 'SET_AUTH_CHECKED':
      return { ...state, authChecked: action.checked };
    case 'SET_SAVE_STATUS':
      return { ...state, saveStatus: action.status, saveError: action.error || '' };
    case 'SET_PAGE_STATS_LOADING':
      if (state.currentPage !== action.page) return state;
      return { ...state, pageStatsLoading: action.loading };
    case 'LOAD_BACKEND_STATE': {
      const mapped = backendToUi(action.config, action.stats || null);
      return {
        ...state,
        ...mapped,
        activeThreads: ((action.stats || null)?.activeThreads || []).map(normalizeActiveThread),
        backendConfig: action.config,
        backendStats: action.stats || null,
        adminToken: action.config.adminToken || '',
        authenticated: true,
        authChecked: true,
        configLoaded: true,
        pageStatsLoading: Boolean(pageStatsPath(state.currentPage)),
        statsRefreshNonce: state.statsRefreshNonce + 1,
        saveStatus: 'idle',
        saveError: '',
        hasUnsavedChanges: false,
      };
    }
    case 'LOAD_BACKEND_STATS':
      if (action.page && action.page !== state.currentPage) return state;
      return applyStatsToState(state, action.stats);
    case 'ADD_PROVIDER':
      return markConfigChanged(state, { providers: [...state.providers, action.provider] });
    case 'UPDATE_PROVIDER':
      return markConfigChanged(state, { providers: state.providers.map(p => p.id === action.provider.id ? action.provider : p) });
    case 'DELETE_PROVIDER':
      return markConfigChanged(state, {
        providers: state.providers.filter(p => p.id !== action.id),
        chains: state.chains.map(chain => ({
          ...chain,
          models: normalizeChainModels(chain.models.filter(model => model.providerId !== action.id)),
        })),
      });
    case 'SET_PROVIDER_MODELS': {
      const providers = state.providers.map(provider => provider.id === action.id
        ? { ...provider, models: uniqueStrings(action.models) }
        : provider
      );
      return markConfigChanged(state, {
        providers,
        chains: synchronizeChainModelsWithProviders(state.chains, providers),
      });
    }
    case 'SET_PROVIDER_STATUS':
      return { ...state, providers: state.providers.map(p => p.id === action.id ? { ...p, status: action.status, latency: action.latency, lastCheck: Date.now() } : p) };
    case 'SET_PROVIDER_HEALTHS':
      return {
        ...state,
        providers: state.providers.map((provider) => {
          const health = action.providers.find((item) =>
            (item.id && item.id === provider.id) ||
            (item.baseUrl === provider.baseUrl && (!item.name || item.name === provider.name))
          );
          if (!health) return provider;
          return {
            ...provider,
            status: health.status,
            latency: health.latency,
            lastCheck: Date.now(),
          };
        }),
      };
    case 'ADD_CHAIN':
      return markConfigChanged(state, { chains: [...state.chains, normalizeChain(action.chain)] });
    case 'UPDATE_CHAIN':
      return markConfigChanged(state, { chains: state.chains.map(c => c.id === action.chain.id ? normalizeChain(action.chain) : c) });
    case 'DELETE_CHAIN':
      return markConfigChanged(state, { chains: state.chains.filter(c => c.id !== action.id) });
    case 'SYNC_CHAIN_MODELS': {
      const synchronizedChain = synchronizeChainModelsWithProviders(state.chains, state.providers)
        .find(chain => chain.id === action.id);
      const currentChain = state.chains.find(chain => chain.id === action.id);
      if (!synchronizedChain || !currentChain || synchronizedChain.models.length === currentChain.models.length) {
        return state;
      }
      return markConfigChanged(state, {
        chains: state.chains.map(chain => chain.id === action.id ? synchronizedChain : chain),
      });
    }
    case 'UPDATE_PROTOCOL_POLICY': {
      const base = state.backendConfig || defaultConfig;
      const field = action.direction === 'chatToResponses'
        ? 'chatCompletionsToResponsesPolicy'
        : 'responsesToChatCompletionsPolicy';
      return markConfigChanged(state, {
        backendConfig: { ...base, [field]: action.policy },
      });
    }
    case 'SET_REQUEST_PASSTHROUGH': {
      const base = state.backendConfig || defaultConfig;
      return markConfigChanged(state, {
        backendConfig: { ...base, passThroughRequestEnabled: action.enabled },
      });
    }
    case 'ADD_LOG':
      return { ...state, logs: [action.log, ...state.logs].slice(0, 200) };
    case 'SET_LOG_SETTINGS':
      return {
        ...state,
        backendConfig: {
          ...(state.backendConfig || defaultConfig),
          logSettings: action.settings,
        },
        backendStats: {
          ...(state.backendStats || {}),
          logSettings: action.settings,
        },
      };
    default:
      return state;
  }
}

function applyStatsToState(state: State, stats: BackendStats): State {
  const hasChains = Object.prototype.hasOwnProperty.call(stats, 'chains');
  const hasLogs = Object.prototype.hasOwnProperty.call(stats, 'logs');
  const hasActiveThreads = Object.prototype.hasOwnProperty.call(stats, 'activeThreads');
  return {
    ...state,
    backendStats: {
      ...(state.backendStats || {}),
      ...stats,
    },
    activeThreads: hasActiveThreads
      ? (stats.activeThreads || []).map(normalizeActiveThread)
      : state.activeThreads,
    chains: hasChains ? state.chains.map((chain) => {
      const modelStats = stats.chains?.[chain.proxyModelName];
      if (!modelStats) return chain;
      const successRate = successRateFromStats(modelStats.successes, modelStats.failures);
      return {
        ...chain,
        totalRequests: modelStats.requests,
        failoverCount: modelStats.failovers,
        successRate,
      };
    }) : state.chains,
    logs: hasLogs ? (stats.logs || []).map((log) => ({
      id: log.id,
      timestamp: log.timestamp,
      chainName: log.chainName,
      originalModel: log.originalModel,
      failedModels: log.failedModels || [],
      failedModelErrors: Array.isArray(log.failedModelErrors)
        ? log.failedModelErrors.map(item => ({
            model: String(item.model || ''),
            error: String(item.error || ''),
          })).filter(item => item.model || item.error)
        : [],
      finalModel: log.finalModel,
      status: log.status,
      latency: log.latency,
      error: log.error,
    })) : state.logs,
  };
}

function normalizeActiveThread(thread: ActiveThread): ActiveThread {
  return {
    id: String(thread.id || ''),
    slot: Math.max(0, Math.floor(Number(thread.slot) || 0)),
    chainName: String(thread.chainName || ''),
    requestedModel: String(thread.requestedModel || ''),
    targetName: String(thread.targetName || ''),
    targetModel: String(thread.targetModel || ''),
    targetBaseUrl: String(thread.targetBaseUrl || ''),
    attempt: Math.max(0, Math.floor(Number(thread.attempt) || 0)),
    maxAttempts: Math.max(0, Math.floor(Number(thread.maxAttempts) || 0)),
    compressionAttempt: Math.max(0, Math.floor(Number(thread.compressionAttempt) || 0)),
    maxCompressionAttempts: Math.max(0, Math.floor(Number(thread.maxCompressionAttempts) || 0)),
    phase: String(thread.phase || 'unknown'),
    status: String(thread.status || ''),
    startedAt: Number(thread.startedAt || 0),
    updatedAt: Number(thread.updatedAt || 0),
    failedModels: Array.isArray(thread.failedModels) ? thread.failedModels.map(String) : [],
    attemptErrors: Array.isArray(thread.attemptErrors)
      ? thread.attemptErrors.map(item => ({
          target: String(item.target || ''),
          attempt: item.attempt === undefined ? undefined : Math.max(0, Math.floor(Number(item.attempt) || 0)),
          status: item.status === undefined ? undefined : Math.max(0, Math.floor(Number(item.status) || 0)),
          message: String(item.message || ''),
          detail: item.detail === undefined ? undefined : String(item.detail || ''),
        }))
      : [],
  };
}

function backendToUi(config: BackendConfig, stats?: BackendStats | null): Pick<State, 'providers' | 'chains' | 'logs'> {
  const providers: Provider[] = (config.providers || [])
    .filter((provider) => provider?.baseUrl)
    .map((provider) => ({
      id: provider.id || uuidv4(),
      name: provider.name || providerNameFromUrl(provider.baseUrl || ''),
      baseUrl: provider.baseUrl || '',
      apiKey: provider.apiKey || '',
      apiKeys: providerApiKeys(provider.apiKey || '', provider.apiKeys || []),
      apiKeyMode: normalizedApiKeyMode(provider.apiKeyMode, provider.apiKeys || [], provider.apiKey || ''),
      models: uniqueStrings(provider.models || []),
      status: 'unknown',
    }));
  const providerKeyToId = new Map<string, string>();
  const firstProxyKey = config.proxyKeys.find(key => key.enabled !== false)?.key || 'sk-local-test';

  providers.forEach((provider) => {
    providerKeyToId.set(providerKey(provider.baseUrl, provider.apiKey, provider.name, provider.apiKeys, provider.apiKeyMode), provider.id);
  });

  function ensureProvider(target: BackendTarget): string {
    const baseUrl = target.baseUrl || '';
    const apiKey = target.apiKey || '';
    const apiKeys = providerApiKeys(apiKey, target.apiKeys || []);
    const apiKeyMode = normalizedApiKeyMode(target.apiKeyMode, apiKeys, apiKey);
    const key = providerKey(baseUrl, apiKey, target.name || '', apiKeys, apiKeyMode);
    const existing = providerKeyToId.get(key);
    if (existing) return existing;

    const provider: Provider = {
      id: uuidv4(),
      name: target.name || providerNameFromUrl(baseUrl),
      baseUrl,
      apiKey,
      apiKeys,
      apiKeyMode,
      models: [],
      status: 'unknown',
    };
    providers.push(provider);
    providerKeyToId.set(key, provider.id);
    return provider.id;
  }

  const chains: FailoverChain[] = (config.models || []).map((model) => {
    const modelStats = stats?.chains?.[model.publicName];
    const modelCircuitBreaker = model.circuitBreaker || config.circuitBreaker || defaultConfig.circuitBreaker;
    const totalRequests = modelStats?.requests || 0;
    const successRate = successRateFromStats(modelStats?.successes || 0, modelStats?.failures || 0);
    const models = (model.targets || []).map((target, index) => {
      const providerId = ensureProvider(target);
      const provider = providers.find(item => item.id === providerId);
      const modelName = target.modelName || target.modelNameTemplate || model.publicName;
      if (provider && modelName && !provider.models.includes(modelName)) {
        provider.models.push(modelName);
      }
      return {
        providerId,
        modelName,
        priority: Math.max(1, Math.floor(Number(target.priority) || index + 1)),
        weight: 1,
        maxRetries: Math.max(0, Math.floor(Number(target.maxRetries) || 0)),
        timeout: Math.max(1, Math.round((target.timeoutMs || config.requestTimeoutMs || 30000) / 1000)),
        enabled: target.enabled !== false,
      };
    }).sort((a, b) => a.priority - b.priority).map((item, index) => ({ ...item, priority: index + 1 }));
    const firstTarget = models[0];

    return {
      id: uuidv4(),
      name: model.publicName,
      description: `代理模型 ${model.publicName}`,
      models,
      strategy: model.strategy === 'weighted' ? 'priority' : model.strategy || 'priority',
      proxyModelName: model.publicName,
      contextWindowTokens: Math.max(1024, Math.floor(Number(model.contextWindowTokens) || 1_000_000)),
      proxyApiKey: firstProxyKey,
      targetTimeoutSeconds: Math.max(1, Math.floor(Number(firstTarget?.timeout) || 30)),
      targetMaxRetries: Math.max(0, Math.floor(Number(firstTarget?.maxRetries) || 0)),
      circuitFailureThreshold: Math.max(1, Math.floor(Number(modelCircuitBreaker?.failureThreshold) || 3)),
      circuitCooldownMinutes: Math.max(1, Math.floor(Number(modelCircuitBreaker?.cooldownMinutes) || 10)),
      enabled: model.enabled !== false,
      createdAt: Date.now(),
      totalRequests,
      failoverCount: modelStats?.failovers || 0,
      successRate,
    };
  });

  const logs: LogEntry[] = (stats?.logs || []).map((log) => ({
    id: log.id,
    timestamp: log.timestamp,
    chainName: log.chainName,
    originalModel: log.originalModel,
    failedModels: log.failedModels || [],
    failedModelErrors: Array.isArray(log.failedModelErrors)
      ? log.failedModelErrors.map(item => ({
          model: String(item.model || ''),
          error: String(item.error || ''),
        })).filter(item => item.model || item.error)
      : [],
    finalModel: log.finalModel,
    status: log.status,
    latency: log.latency,
    error: log.error,
  }));

  return { providers, chains, logs };
}

function providerKey(baseUrl: string, apiKey: string, name: string, apiKeys: string[] = [], apiKeyMode: Provider['apiKeyMode'] = 'single') {
  return `${baseUrl || ''}||${apiKey || ''}||${name || ''}||${apiKeyMode}||${apiKeys.join('\n')}`;
}

function successRateFromStats(successes: number, failures: number): number | null {
  const finished = successes + failures;
  return finished ? Number(((successes / finished) * 100).toFixed(1)) : null;
}

function uniqueStrings(items: string[]) {
  return [...new Set(items.map(item => String(item).trim()).filter(Boolean))];
}

function providerApiKeys(apiKey: string, apiKeys: string[]) {
  const keys = uniqueStrings(apiKeys);
  if (!keys.length && apiKey.trim()) keys.push(apiKey.trim());
  return keys;
}

function normalizedApiKeyMode(mode: unknown, apiKeys: string[], apiKey: string): Provider['apiKeyMode'] {
  const keys = providerApiKeys(apiKey, apiKeys);
  if (keys.length <= 1) return 'single';
  return mode === 'round-robin' || mode === 'random' ? mode : 'round-robin';
}

function uiToBackend(state: State): BackendConfig {
  const base = state.backendConfig || defaultConfig;
  const synchronizedChains = synchronizeChainModelsWithProviders(state.chains, state.providers);
  const keyMap = new Map<string, string>();
  synchronizedChains.forEach((chain, index) => {
    if (chain.proxyApiKey) keyMap.set(chain.proxyApiKey, chain.name || `chain-${index + 1}`);
  });

  const proxyKeys = Array.from(keyMap.entries()).map(([key, name]) => ({
    name,
    key,
    enabled: true,
  }));

  const models: BackendModel[] = synchronizedChains.map((chain) => ({
    publicName: chain.proxyModelName,
    contextWindowTokens: Math.max(1024, Math.floor(Number(chain.contextWindowTokens) || 1_000_000)),
    enabled: chain.enabled,
    strategy: chain.strategy,
    circuitBreaker: {
      failureThreshold: Math.max(1, Math.floor(Number(chain.circuitFailureThreshold) || 3)),
      cooldownMinutes: Math.max(1, Math.floor(Number(chain.circuitCooldownMinutes) || 10)),
    },
    targets: [...chain.models]
      .sort((a, b) => a.priority - b.priority)
      .map((model, index) => {
        const provider = state.providers.find(item => item.id === model.providerId);
        return {
          name: provider?.name || model.modelName,
          baseUrl: provider?.baseUrl || '',
          apiKey: provider?.apiKey || '',
          apiKeys: provider?.apiKeys || [],
          apiKeyMode: provider?.apiKeyMode || 'single',
          modelName: model.modelName,
          enabled: model.enabled,
          priority: index + 1,
          weight: 1,
          maxRetries: Math.max(0, Math.floor(Number(chain.targetMaxRetries ?? model.maxRetries) || 0)),
          timeoutMs: Math.max(1, Math.floor(Number(chain.targetTimeoutSeconds || model.timeout) || 30)) * 1000,
        };
      })
      .filter(target => target.baseUrl && (target.apiKey || target.apiKeys.length) && target.modelName),
  }));

  const providers: BackendProvider[] = state.providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    apiKeys: provider.apiKeys || [],
    apiKeyMode: provider.apiKeyMode || 'single',
    models: uniqueStrings(provider.models || []),
  }));

  return {
    ...base,
    adminToken: state.adminToken || base.adminToken || 'admin',
    proxyKeys: proxyKeys.length ? proxyKeys : base.proxyKeys,
    circuitBreaker: base.circuitBreaker || defaultConfig.circuitBreaker,
    providers,
    models,
  };
}

function providerNameFromUrl(baseUrl: string) {
  try {
    return new URL(baseUrl).hostname.replace(/^api\./, '');
  } catch {
    return baseUrl || 'Provider';
  }
}

async function readJsonError(res: Response) {
  const body = await res.json().catch(() => null);
  return body?.error?.message || `${res.status} ${res.statusText}`;
}

function pageStatsPath(page: Page) {
  switch (page) {
    case 'dashboard':
    case 'chains':
    case 'model-stats':
    case 'live-status':
    case 'circuit-breakers':
    case 'logs':
      return `/api/stats/page/${page}`;
    default:
      return '';
  }
}

function pageNeedsProviderHealth(page: Page) {
  return page === 'dashboard' || page === 'providers';
}

const StoreContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  loadConfig: (sessionOverride?: string) => Promise<void>;
  saveConfig: () => Promise<void>;
  fetchProviderModels: (url: string, apiKey: string) => Promise<string[]>;
  refreshProviderHealth: (providerId?: string, refresh?: boolean) => Promise<void>;
  runModelTests: (targets: ModelTestTarget[], capabilities: ModelCapability[], signal?: AbortSignal) => Promise<ModelTestResult[]>;
  saveLogSettings: (settings: LogSettings) => Promise<LogSettings>;
  clearLogs: () => Promise<void>;
} | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const adminHeaders = useCallback((sessionOverride?: string) => ({
    'x-admin-session': sessionOverride || state.adminSession,
  }), [state.adminSession]);

  const handleUnauthorized = useCallback((res: Response) => {
    if (res.status === 401) dispatch({ type: 'CLEAR_AUTH' });
  }, []);

  const loadConfig = useCallback(async (sessionOverride?: string) => {
    const session = sessionOverride || state.adminSession;
    if (!session) {
      dispatch({ type: 'CLEAR_AUTH' });
      return;
    }
    dispatch({ type: 'SET_SAVE_STATUS', status: 'loading' });
    const res = await fetch('/api/config', {
      headers: adminHeaders(session),
      cache: 'no-store',
    });
    if (!res.ok) {
      handleUnauthorized(res);
      const message = await readJsonError(res);
      dispatch({ type: 'SET_SAVE_STATUS', status: 'error', error: message });
      throw new Error(message);
    }
    const config = await res.json();
    dispatch({ type: 'LOAD_BACKEND_STATE', config });
  }, [state.adminSession, adminHeaders, handleUnauthorized]);

  const login = useCallback(async (token: string) => {
    dispatch({ type: 'SET_SAVE_STATUS', status: 'loading' });
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const message = await readJsonError(res);
      dispatch({ type: 'SET_SAVE_STATUS', status: 'error', error: message });
      throw new Error(message);
    }
    const body = await res.json();
    const session = String(body.session || '');
    if (!session) throw new Error('Login response did not include a session');
    dispatch({ type: 'SET_ADMIN_SESSION', session });
    await loadConfig(session);
  }, [loadConfig]);

  const logout = useCallback(async () => {
    const session = state.adminSession;
    if (session) {
      await fetch('/api/logout', {
        method: 'POST',
        headers: adminHeaders(session),
        cache: 'no-store',
      }).catch(() => undefined);
    }
    dispatch({ type: 'CLEAR_AUTH' });
  }, [state.adminSession, adminHeaders]);

  const saveConfig = useCallback(async () => {
    const session = state.adminSession;
    if (!session) {
      dispatch({ type: 'CLEAR_AUTH' });
      return;
    }
    dispatch({ type: 'SET_SAVE_STATUS', status: 'saving' });
    const nextConfig = uiToBackend(state);
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(session),
      },
      cache: 'no-store',
      body: JSON.stringify(nextConfig),
    });
    if (!res.ok) {
      handleUnauthorized(res);
      const message = await readJsonError(res);
      dispatch({ type: 'SET_SAVE_STATUS', status: 'error', error: message });
      throw new Error(message);
    }
    const body = await res.json();
    dispatch({ type: 'LOAD_BACKEND_STATE', config: body.config });
    dispatch({ type: 'SET_SAVE_STATUS', status: 'saved' });
  }, [state, adminHeaders, handleUnauthorized]);

  const fetchProviderModels = useCallback(async (url: string, apiKey: string) => {
    const res = await fetch('/api/model-source/preview', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      cache: 'no-store',
      body: JSON.stringify({ url, apiKey }),
    });
    handleUnauthorized(res);
    if (!res.ok) throw new Error(await readJsonError(res));
    const body = await res.json();
    return body.models || [];
  }, [adminHeaders, handleUnauthorized]);

  const providerHealthSignature = useMemo(
    () => state.providers.map((provider) => `${provider.id}:${provider.name}:${provider.baseUrl}:${provider.apiKey}:${provider.apiKeyMode}:${(provider.apiKeys || []).join(',')}`).join('|'),
    [state.providers]
  );

  const providerHealthRequest = useMemo(
    () => state.providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      apiKeys: provider.apiKeys || [],
      apiKeyMode: provider.apiKeyMode || 'single',
    })),
    [providerHealthSignature]
  );

  const refreshProviderHealth = useCallback(async (providerId?: string, refresh = false) => {
    if (!state.configLoaded || !providerHealthRequest.length) return;
    const providers = providerId
      ? providerHealthRequest.filter(provider => provider.id === providerId)
      : providerHealthRequest;
    if (!providers.length) return;
    const res = await fetch('/api/providers/health', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      cache: 'no-store',
      body: JSON.stringify({ providers, refresh }),
    });
    handleUnauthorized(res);
    if (!res.ok) throw new Error(await readJsonError(res));
    const body = await res.json();
    dispatch({ type: 'SET_PROVIDER_HEALTHS', providers: body.providers || [] });
  }, [state.configLoaded, providerHealthRequest, adminHeaders, handleUnauthorized]);

  const runModelTests = useCallback(async (targets: ModelTestTarget[], capabilities: ModelCapability[], signal?: AbortSignal) => {
    const res = await fetch('/api/model-tests/run', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      signal,
      cache: 'no-store',
      body: JSON.stringify({ targets, capabilities }),
    });
    handleUnauthorized(res);
    if (!res.ok) throw new Error(await readJsonError(res));
    const body = await res.json();
    return body.results || [];
  }, [adminHeaders, handleUnauthorized]);

  const saveLogSettings = useCallback(async (settings: LogSettings) => {
    const res = await fetch('/api/log-settings', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...adminHeaders(),
      },
      cache: 'no-store',
      body: JSON.stringify(settings),
    });
    handleUnauthorized(res);
    if (!res.ok) throw new Error(await readJsonError(res));
    const body = await res.json();
    const applied = body.settings || settings;
    dispatch({ type: 'SET_LOG_SETTINGS', settings: applied });
    dispatch({ type: 'SET_PAGE', page: 'logs' });
    return applied;
  }, [adminHeaders, handleUnauthorized]);

  const clearLogs = useCallback(async () => {
    const res = await fetch('/api/logs/clear', {
      method: 'POST',
      headers: adminHeaders(),
      cache: 'no-store',
    });
    handleUnauthorized(res);
    if (!res.ok) throw new Error(await readJsonError(res));
    dispatch({ type: 'LOAD_BACKEND_STATS', stats: { logs: [] }, page: 'logs' });
    dispatch({ type: 'SET_PAGE', page: 'logs' });
  }, [adminHeaders, handleUnauthorized]);

  const fetchPageStats = useCallback(async (page: Page, signal?: AbortSignal) => {
    const path = pageStatsPath(page);
    if (!path || !state.configLoaded) return;
    const res = await fetch(path, {
      headers: adminHeaders(),
      signal,
      cache: 'no-store',
    });
    if (res.status === 401) {
      dispatch({ type: 'CLEAR_AUTH' });
      return;
    }
    if (!res.ok) return;
    const stats = await res.json();
    dispatch({ type: 'LOAD_BACKEND_STATS', stats, page });
  }, [state.configLoaded, adminHeaders]);

  useEffect(() => {
    if (state.authChecked) return;
    if (!state.adminSession) {
      dispatch({ type: 'SET_AUTH_CHECKED', checked: true });
      return;
    }
    loadConfig(state.adminSession).catch(() => dispatch({ type: 'CLEAR_AUTH' }));
  }, [state.authChecked, state.adminSession, loadConfig]);

  useEffect(() => {
    if (!state.configLoaded) return undefined;
    const page = state.currentPage;
    if (!pageStatsPath(page)) return undefined;
    let activeController: AbortController | null = null;
    let requestTimeout: number | null = null;
    let stopped = false;
    const load = (firstLoad = false) => {
      if (activeController) return;
      const controller = new AbortController();
      activeController = controller;
      requestTimeout = window.setTimeout(() => controller.abort(), 15_000);
      fetchPageStats(page, controller.signal)
        .catch((err) => {
          if (!(err instanceof DOMException && err.name === 'AbortError')) {
            return undefined;
          }
          return undefined;
        })
        .finally(() => {
          if (requestTimeout !== null) {
            window.clearTimeout(requestTimeout);
            requestTimeout = null;
          }
          if (activeController === controller) activeController = null;
          if (firstLoad) {
            dispatch({ type: 'SET_PAGE_STATS_LOADING', page, loading: false });
          }
        });
    };
    dispatch({ type: 'SET_PAGE_STATS_LOADING', page, loading: true });
    load(true);
    if (page !== 'live-status' && page !== 'circuit-breakers') {
      return () => {
        stopped = true;
        activeController?.abort();
        if (requestTimeout !== null) window.clearTimeout(requestTimeout);
      };
    }
    const timer = window.setInterval(() => {
      if (!stopped) load();
    }, 1000);
    return () => {
      stopped = true;
      activeController?.abort();
      if (requestTimeout !== null) window.clearTimeout(requestTimeout);
      window.clearInterval(timer);
    };
  }, [state.configLoaded, state.currentPage, state.statsRefreshNonce, fetchPageStats]);

  useEffect(() => {
    if (!state.configLoaded || !state.providers.length || !pageNeedsProviderHealth(state.currentPage)) return;
    refreshProviderHealth().catch(() => undefined);
  }, [state.configLoaded, state.currentPage, providerHealthSignature, refreshProviderHealth]);

  return (
    <StoreContext.Provider value={{ state, dispatch, login, logout, loadConfig, saveConfig, fetchProviderModels, refreshProviderHealth, runModelTests, saveLogSettings, clearLogs }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
