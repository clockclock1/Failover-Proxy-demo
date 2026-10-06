import { useState } from 'react';
import {
  Link2,
  Copy,
  CheckCircle2,

  Code2,
  Terminal,
  Eye,
  EyeOff,
  Shield,
  Globe,
} from 'lucide-react';
import { useStore } from '../store';
import { cn } from '../utils/cn';

export default function ProxyEndpoints() {
  const { state } = useStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());
  const [baseEndpoint, setBaseEndpoint] = useState(`${window.location.origin}/v1`);
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleKeyVisibility = (id: string) => {
    const next = new Set(showKeys);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setShowKeys(next);
  };

  const enabledChains = state.chains.filter(c => c.enabled);
  const selectedChain = selectedChainId ? state.chains.find(c => c.id === selectedChainId) : enabledChains[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">代理端点</h2>
        <p className="text-slate-500 mt-1">查看和管理代理服务的 API 端点信息</p>
      </div>

      {/* Base Endpoint Config */}
      <div className="motion-card bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Globe size={18} className="text-slate-600" />
          <h3 className="font-semibold text-slate-800">代理服务地址</h3>
        </div>
        <div className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Base URL</label>
              <input
                value={baseEndpoint}
                onChange={e => setBaseEndpoint(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-mono transition-all"
                placeholder="http://localhost:8080/v1"
              />
            </div>
            <button
              onClick={() => copyToClipboard(baseEndpoint, 'base')}
              className="px-4 py-2.5 border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {copiedId === 'base' ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
              复制
            </button>
          </div>
        </div>
      </div>

      {/* Endpoint List */}
      <div className="proxy-endpoint-card motion-card bg-white rounded-xl border border-slate-200 overflow-hidden" style={{ animationDelay: '45ms' }}>
        <div className="proxy-endpoint-card-header px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Link2 size={18} className="text-slate-600" />
          <h3 className="font-semibold text-slate-800">可用端点</h3>
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full ml-auto">{enabledChains.length} 个活跃</span>
        </div>

        <div className="proxy-endpoint-list divide-y divide-slate-50">
          {state.chains.map((chain, index) => (
            <div
              key={chain.id}
              className={cn(
                'proxy-endpoint-row table-row-motion px-5 py-4 transition-colors cursor-pointer',
                selectedChain?.id === chain.id ? 'proxy-endpoint-row-selected bg-blue-50/30' : 'hover:bg-slate-50'
              )}
              style={{ animationDelay: `${Math.min(index, 14) * 22}ms` }}
              onClick={() => setSelectedChainId(chain.id)}
            >
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    chain.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                  )} />
                  <span className="truncate font-medium text-slate-800">{chain.name}</span>
                  <span className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full',
                    chain.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                  )}>
                    {chain.enabled ? '运行中' : '已停止'}
                  </span>
                </div>
                <span className="text-xs text-slate-400">{chain.models.length} 个备选模型</span>
              </div>

              {/* Endpoint details */}
              <div className="space-y-2 sm:ml-5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-16 flex-shrink-0">模型名：</span>
                  <code className="min-w-0 truncate text-xs font-mono bg-slate-100 px-2 py-1 rounded text-blue-600 flex-1">
                    {chain.proxyModelName}
                  </code>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(chain.proxyModelName, 'model-' + chain.id); }}
                    className="text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    {copiedId === 'model-' + chain.id ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-16 flex-shrink-0">API Key：</span>
                  <code className="min-w-0 truncate text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600 flex-1">
                    {showKeys.has(chain.id) ? chain.proxyApiKey : chain.proxyApiKey.slice(0, 8) + '••••••••••••'}
                  </code>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleKeyVisibility(chain.id); }}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showKeys.has(chain.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(chain.proxyApiKey, 'key-' + chain.id); }}
                    className="text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    {copiedId === 'key-' + chain.id ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-16 flex-shrink-0">端点：</span>
                  <code className="min-w-0 truncate text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600 flex-1">
                    {baseEndpoint}/chat/completions
                  </code>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(`${baseEndpoint}/chat/completions`, 'ep-' + chain.id); }}
                    className="text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    {copiedId === 'ep-' + chain.id ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-16 flex-shrink-0">Responses:</span>
                  <div className="min-w-0 flex-1">
                    <code className="block truncate text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">
                      {baseEndpoint}/responses
                    </code>
                    <p className="mt-1 truncate text-[10px] text-slate-400">also accepts {baseEndpoint}/response</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(`${baseEndpoint}/responses`, 'responses-' + chain.id); }}
                    className="text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    {copiedId === 'responses-' + chain.id ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {state.chains.length === 0 && (
            <div className="px-5 py-10 text-center text-slate-400 text-sm">
              请先创建故障转移链
            </div>
          )}
        </div>
      </div>

      {/* Code Example */}
      {selectedChain && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* cURL */}
          <div className="motion-card bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-slate-500" />
                <span className="text-sm font-medium text-slate-700">cURL</span>
              </div>
              <button
                onClick={() => copyToClipboard(
                  `curl ${baseEndpoint}/chat/completions \\\n  -H "Authorization: Bearer ${selectedChain.proxyApiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "model": "${selectedChain.proxyModelName}",\n    "messages": [{"role": "user", "content": "Hello!"}]\n  }'`,
                  'curl'
                )}
                className="text-xs text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1"
              >
                {copiedId === 'curl' ? <><CheckCircle2 size={12} className="text-emerald-500" /> 已复制</> : <><Copy size={12} /> 复制</>}
              </button>
            </div>
            <div className="uiverse-code-sample p-4 bg-slate-900 text-slate-300 text-xs font-mono leading-relaxed overflow-x-auto">
              <pre className="uiverse-code-pre">{`curl ${baseEndpoint}/chat/completions \\
  -H "Authorization: Bearer ${selectedChain.proxyApiKey.slice(0, 8)}..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${selectedChain.proxyModelName}",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`}</pre>
            </div>
          </div>

          {/* Python */}
          <div className="motion-card bg-white rounded-xl border border-slate-200 overflow-hidden" style={{ animationDelay: '60ms' }}>
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 size={16} className="text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Python</span>
              </div>
              <button
                onClick={() => copyToClipboard(
                  `from openai import OpenAI\n\nclient = OpenAI(\n    base_url="${baseEndpoint}",\n    api_key="${selectedChain.proxyApiKey}"\n)\n\nresponse = client.chat.completions.create(\n    model="${selectedChain.proxyModelName}",\n    messages=[{"role": "user", "content": "Hello!"}]\n)`,
                  'python'
                )}
                className="text-xs text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1"
              >
                {copiedId === 'python' ? <><CheckCircle2 size={12} className="text-emerald-500" /> 已复制</> : <><Copy size={12} /> 复制</>}
              </button>
            </div>
            <div className="uiverse-code-sample p-4 bg-slate-900 text-slate-300 text-xs font-mono leading-relaxed overflow-x-auto">
              <pre className="uiverse-code-pre">{`from openai import OpenAI

client = OpenAI(
    base_url="${baseEndpoint}",
    api_key="${selectedChain.proxyApiKey.slice(0, 8)}..."
)

response = client.chat.completions.create(
    model="${selectedChain.proxyModelName}",
    messages=[
      {"role": "user", "content": "Hello!"}
    ]
)`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="motion-card bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3">
        <Shield size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">安全提示</p>
          <p className="text-xs text-amber-700 mt-1">
            请妥善保管您的代理 API Key，不要将其暴露在公开的代码仓库或客户端代码中。
            建议在生产环境中使用环境变量来管理 Key。
          </p>
        </div>
      </div>
    </div>
  );
}
