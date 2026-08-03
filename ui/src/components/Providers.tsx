import { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Globe,
  Key,
  Server,
  Download,
  X,
  Search,
  Check,
  AlertCircle,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../store';
import type { Provider } from '../types';
import { cn } from '../utils/cn';
import LoadingOverlay, { LoadingSpinner } from './Loading';

type ModelListFilter = 'new' | 'existing' | 'deleted';

function uniqueStrings(items: string[]) {
  return [...new Set(items.map(item => item.trim()).filter(Boolean))];
}

function firstApiKey(provider: Pick<Provider, 'apiKey' | 'apiKeys'>) {
  return provider.apiKey || provider.apiKeys?.[0] || '';
}

function normalizeApiKeys(mode: Provider['apiKeyMode'], apiKey: string, text: string) {
  const keys = mode === 'single' ? uniqueStrings([apiKey]) : uniqueStrings(text.split(/\r?\n/));
  return {
    apiKey: keys[0] || '',
    apiKeys: keys,
    apiKeyMode: keys.length <= 1 ? 'single' as const : mode,
  };
}

// Modal for adding/editing providers
function ProviderModal({
  provider,
  onSave,
  onClose,
}: {
  provider?: Provider;
  onSave: (p: Provider) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(provider?.name || '');
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl || '');
  const [apiKey, setApiKey] = useState(provider?.apiKey || '');
  const [apiKeyMode, setApiKeyMode] = useState<Provider['apiKeyMode']>(provider?.apiKeyMode || 'single');
  const [apiKeysText, setApiKeysText] = useState(
    (provider?.apiKeys?.length ? provider.apiKeys : provider?.apiKey ? [provider.apiKey] : []).join('\n')
  );

  const handleSave = () => {
    if (!name || !baseUrl) return;
    const normalizedKeys = normalizeApiKeys(apiKeyMode, apiKey, apiKeysText);
    onSave({
      id: provider?.id || uuidv4(),
      name,
      baseUrl: baseUrl.replace(/\/$/, ''),
      ...normalizedKeys,
      models: provider?.models || [],
      status: provider?.status || 'unknown',
      latency: provider?.latency,
      lastCheck: provider?.lastCheck,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-lg shadow-2xl max-h-[94dvh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">{provider ? '编辑提供商' : '添加提供商'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 sm:p-6 space-y-4 overflow-auto">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">提供商名称</label>
            <div className="relative">
              <Server size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm transition-all"
                placeholder="例如：OpenAI, Anthropic..."
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Base URL</label>
            <div className="relative">
              <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-mono transition-all"
                placeholder="https://api.openai.com/v1"
              />
            </div>
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="block text-sm font-medium text-slate-700">API Key</label>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
                {([
                  ['single', '单 Key'],
                  ['round-robin', '多 Key 轮询'],
                  ['random', '多 Key 随机'],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      if (mode === 'single') {
                        const first = uniqueStrings(apiKeysText.split(/\r?\n/))[0];
                        if (first && !apiKey) setApiKey(first);
                      } else if (!apiKeysText.trim() && apiKey.trim()) {
                        setApiKeysText(apiKey.trim());
                      }
                      setApiKeyMode(mode);
                    }}
                    className={cn(
                      'rounded-md px-2.5 py-1 font-medium transition-colors',
                      apiKeyMode === mode ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              {apiKeyMode === 'single' ? (
                <input
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  type="password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-mono transition-all"
                  placeholder="sk-..."
                />
              ) : (
                <textarea
                  value={apiKeysText}
                  onChange={e => setApiKeysText(e.target.value)}
                  wrap="off"
                  spellCheck={false}
                  className="api-key-lines-textarea min-h-32 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 pl-10 font-mono text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  placeholder={'sk-key-1\nsk-key-2\nsk-key-3'}
                />
              )}
            </div>
          </div>
        </div>
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!name || !baseUrl}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal for fetching models from URL
function FetchModelsModal({
  provider,
  onClose,
  onModelsSelected,
}: {
  provider: Provider;
  onClose: () => void;
  onModelsSelected: (models: string[]) => void;
}) {
  const { state, fetchProviderModels } = useStore();
  const [loading, setLoading] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [hasFetchedModelList, setHasFetchedModelList] = useState(false);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set(provider.models));
  const [activeModelFilter, setActiveModelFilter] = useState<ModelListFilter>('existing');
  const [error, setError] = useState('');
  const [customUrl, setCustomUrl] = useState(provider.baseUrl + '/models');
  const [searchTerm, setSearchTerm] = useState('');
  const [customModelName, setCustomModelName] = useState('');
  const [customModels, setCustomModels] = useState<string[]>([]);

  const availableModels = uniqueStrings([...provider.models, ...fetchedModels, ...customModels]);
  const committedModels = new Set(provider.models);
  const fetchedModelSet = new Set(fetchedModels);
  const customModelSet = new Set(customModels);
  const newFetchedModelCount = fetchedModels.filter(model => !committedModels.has(model)).length;
  const existingModelCount = committedModels.size;
  const removedUpstreamModelCount = hasFetchedModelList
    ? [...committedModels].filter(model => !fetchedModelSet.has(model) && !customModelSet.has(model)).length
    : 0;
  const modelsForActiveFilter = activeModelFilter === 'new'
    ? fetchedModels.filter(model => !committedModels.has(model))
    : activeModelFilter === 'existing'
      ? availableModels.filter(model => committedModels.has(model))
      : hasFetchedModelList
        ? availableModels.filter(model => committedModels.has(model) && !fetchedModelSet.has(model) && !customModelSet.has(model))
        : [];
  const filteredModels = modelsForActiveFilter.filter(model =>
    model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fetchModels = async () => {
    setLoading(true);
    setError('');
    try {
      const models = uniqueStrings(await fetchProviderModels(customUrl, firstApiKey(provider)));
      setFetchedModels(models);
      setHasFetchedModelList(true);
      const nextAvailableModels = uniqueStrings([...provider.models, ...models, ...customModels]);
      setSelectedModels(current => new Set(
        [...current].filter(model => nextAvailableModels.includes(model))
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : '模型拉取失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleModel = (model: string) => {
    const next = new Set(selectedModels);
    if (next.has(model)) next.delete(model);
    else next.add(model);
    setSelectedModels(next);
  };

  const selectAll = () => setSelectedModels(current => new Set([...current, ...filteredModels]));
  const deselectAll = () => setSelectedModels(current => {
    const next = new Set(current);
    filteredModels.forEach(model => next.delete(model));
    return next;
  });

  const addCustomModel = () => {
    const model = customModelName.trim();
    if (!model) return;
    setCustomModels(current => uniqueStrings([...current, model]));
    setSelectedModels(current => new Set([...current, model]));
    setCustomModelName('');
    setError('');
  };

  return (
    <>
    <LoadingOverlay show={loading} label="正在拉取模型..." />
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4" onClick={onClose}>
      <div className="uiverse-fetch-models-modal bg-white rounded-xl sm:rounded-2xl w-full max-w-2xl shadow-2xl max-h-[94dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">拉取模型列表</h3>
            <p className="text-xs text-slate-400 mt-0.5">{provider.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-auto">
          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">模型列表 URL</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={customUrl}
                  onChange={e => setCustomUrl(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-mono transition-all"
                  placeholder="https://api.example.com/v1/models"
                />
              </div>
              <button
                onClick={fetchModels}
                disabled={loading}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-sm flex-shrink-0"
              >
                {loading ? <LoadingSpinner size="sm" /> : <Download size={16} />}
                拉取
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <label className="mb-2 block text-sm font-medium text-slate-700">添加自定义模型</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={customModelName}
                onChange={e => setCustomModelName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomModel();
                  }
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="例如：gpt-4.1-mini"
              />
              <button
                type="button"
                onClick={addCustomModel}
                disabled={!customModelName.trim()}
                className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} />
                添加
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Model List */}
          {(availableModels.length > 0 || hasFetchedModelList) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div role="tablist" aria-label="模型分类" className="flex min-w-0 items-center text-sm font-medium">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeModelFilter === 'new'}
                    onClick={() => setActiveModelFilter('new')}
                    className={cn('transition-colors', activeModelFilter === 'new' ? 'text-blue-600' : 'text-slate-700 hover:text-blue-600')}
                  >
                    新获取的模型 ({newFetchedModelCount})
                  </button>
                  <span className="mx-1.5 text-slate-300">/</span>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeModelFilter === 'existing'}
                    onClick={() => setActiveModelFilter('existing')}
                    className={cn('transition-colors', activeModelFilter === 'existing' ? 'text-blue-600' : 'text-slate-700 hover:text-blue-600')}
                  >
                    已有的模型 ({existingModelCount})
                  </button>
                  <span className="mx-1.5 text-slate-300">/</span>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeModelFilter === 'deleted'}
                    onClick={() => setActiveModelFilter('deleted')}
                    className={cn('transition-colors', activeModelFilter === 'deleted' ? 'text-blue-600' : 'text-slate-700 hover:text-blue-600')}
                  >
                    上游已删除的模型 ({removedUpstreamModelCount})
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-700">全选</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={deselectAll} className="text-xs text-slate-500 hover:text-slate-700">全不选</button>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm transition-all"
                  placeholder="搜索模型..."
                />
              </div>

              <div className="uiverse-model-picker-list border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                {filteredModels.map(model => {
                  const isSelected = selectedModels.has(model);
                  const isChat = !model.includes('embed') && !model.includes('whisper') && !model.includes('tts') && !model.includes('dall');
                  const isCustom = customModels.includes(model);
                  const usedChains = state.chains.filter(chain =>
                    chain.models.some(item => item.providerId === provider.id && item.modelName === model)
                  );
                  const usageTitle = usedChains.length
                    ? usedChains.map(chain => chain.name).join('、')
                    : '当前故障转移链未使用该模型';
                  return (
                    <button
                      key={model}
                      onClick={() => toggleModel(model)}
                      className={cn(
                        'uiverse-model-option w-full flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 text-sm border-b border-slate-50 last:border-b-0 transition-colors',
                        isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={cn(
                          'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                          isSelected
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-slate-300'
                        )}>
                          {isSelected && <Check size={12} className="text-white" />}
                        </div>
                        <span className={cn('truncate font-mono', isSelected ? 'text-blue-700' : 'text-slate-700')}>
                          {model}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {isCustom && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                            自定义
                          </span>
                        )}
                        {isSelected && (
                          <span
                            title={usageTitle}
                            className={cn(
                              'uiverse-model-chain-usage max-w-[150px] truncate rounded-full px-2 py-0.5 text-[10px] font-medium',
                              usedChains.length
                                ? 'bg-violet-50 text-violet-600'
                                : 'bg-slate-100 text-slate-500'
                            )}
                          >
                            {usedChains.length ? `已用于 ${usedChains.length} 链` : '未用于转移链'}
                          </span>
                        )}
                        <span className={cn(
                          'uiverse-model-kind text-[10px] px-2 py-0.5 rounded-full',
                          isChat ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                        )}>
                          {isChat ? 'Chat' : 'Other'}
                        </span>
                      </div>
                    </button>
                  );
                })}
                {filteredModels.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">
                    {searchTerm ? '没有匹配的模型' : '此分类暂无模型'}
                  </p>
                )}
              </div>

              <p className="text-xs text-slate-400 mt-2">
                已选择 {selectedModels.size} 个模型
              </p>
            </div>
          )}
          {availableModels.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">
              <p className="text-sm text-slate-500">暂无可选模型</p>
              <p className="mt-1 text-xs text-slate-400">可以先拉取远端模型，或添加一个自定义模型。</p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
            取消
          </button>
          <button
            onClick={() => {
              onModelsSelected(uniqueStrings(Array.from(selectedModels)));
              onClose();
            }}
            disabled={selectedModels.size === 0}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            确认选择 ({selectedModels.size})
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

export default function Providers() {
  const { state, dispatch, refreshProviderHealth } = useStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | undefined>();
  const [fetchingProvider, setFetchingProvider] = useState<Provider | undefined>();
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const handleSave = (p: Provider) => {
    if (editingProvider) {
      dispatch({ type: 'UPDATE_PROVIDER', provider: p });
    } else {
      dispatch({ type: 'ADD_PROVIDER', provider: p });
    }
    setShowAddModal(false);
    setEditingProvider(undefined);
  };

  const handleDelete = (id: string) => {
    dispatch({ type: 'DELETE_PROVIDER', id });
  };

  const handleCheckHealth = async (id: string) => {
    setCheckingId(id);
    try {
      await refreshProviderHealth(id, true);
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">模型提供商</h2>
          <p className="text-slate-500 mt-1">管理 API 提供商及其模型列表</p>
        </div>
        <button
          onClick={() => { setEditingProvider(undefined); setShowAddModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-sm shadow-blue-200"
        >
          <Plus size={16} />
          添加提供商
        </button>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {state.providers.map((provider, index) => (
          <div key={provider.id} className="motion-card bg-white rounded-xl border border-slate-200 overflow-hidden hover:-translate-y-0.5 hover:shadow-md" style={{ animationDelay: `${index * 35}ms` }}>
            <div className="px-4 py-4 sm:px-5 border-b border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    provider.status === 'online' ? 'bg-emerald-50' :
                    provider.status === 'offline' ? 'bg-red-50' : 'bg-slate-50'
                  )}>
                    <Server size={20} className={cn(
                      provider.status === 'online' ? 'text-emerald-600' :
                      provider.status === 'offline' ? 'text-red-500' : 'text-slate-400'
                    )} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="truncate font-semibold text-slate-800">{provider.name}</h4>
                    <p className="truncate text-xs text-slate-400 font-mono">{provider.baseUrl}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {provider.apiKeyMode === 'random'
                        ? `多 Key 随机 · ${(provider.apiKeys || []).length} 个`
                        : provider.apiKeyMode === 'round-robin'
                          ? `多 Key 轮询 · ${(provider.apiKeys || []).length} 个`
                          : '单 Key'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCheckHealth(provider.id)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="健康检查"
                  >
                    {checkingId === provider.id ? <LoadingSpinner size="sm" className="text-blue-600" /> : <RefreshCw size={16} />}
                  </button>
                  <button
                    onClick={() => { setEditingProvider(provider); setShowAddModal(true); }}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    title="编辑"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(provider.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 sm:px-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">状态</span>
                <div className="flex items-center gap-2">
                  {provider.status === 'online' && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 size={12} /> 在线
                    </span>
                  )}
                  {provider.status === 'offline' && (
                    <span className="flex items-center gap-1 text-xs text-red-500">
                      <XCircle size={12} /> 离线
                    </span>
                  )}
                  {provider.status === 'unknown' && (
                    <span className="text-xs text-slate-400">未检测</span>
                  )}
                  {provider.latency !== undefined && (
                    <span className="text-xs font-mono text-slate-400">{provider.latency}ms</span>
                  )}
                </div>
              </div>

              {/* Models */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">模型 ({provider.models.length})</span>
                <button
                  onClick={() => setFetchingProvider(provider)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Download size={12} />
                  拉取模型
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {provider.models.map(model => (
                  <span key={model} className="inline-block max-w-full truncate text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-mono">
                    {model}
                  </span>
                ))}
                {provider.models.length === 0 && (
                  <span className="text-xs text-slate-400">暂无模型，请点击 "拉取模型" 获取</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {state.providers.length === 0 && (
        <div className="motion-card text-center py-16 bg-white rounded-xl border border-slate-200">
          <Server size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">暂无提供商</p>
          <p className="text-xs text-slate-400 mt-1">点击上方按钮添加第一个 API 提供商</p>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <ProviderModal
          provider={editingProvider}
          onSave={handleSave}
          onClose={() => { setShowAddModal(false); setEditingProvider(undefined); }}
        />
      )}
      {fetchingProvider && (
        <FetchModelsModal
          provider={fetchingProvider}
          onClose={() => setFetchingProvider(undefined)}
          onModelsSelected={models => {
            dispatch({ type: 'SET_PROVIDER_MODELS', id: fetchingProvider.id, models });
          }}
        />
      )}
    </div>
  );
}
