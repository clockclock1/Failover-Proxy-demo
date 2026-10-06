import { ArrowLeftRight, Shield } from 'lucide-react';
import { useStore } from '../store';

type ProtocolPolicy = {
  enabled: boolean;
  allTargets: boolean;
  targetNames: string[];
  modelPatterns: string[];
};

function PolicyEditor({
  direction,
  title,
  description,
  emptyPatternsMatchAll = false,
}: {
  direction: 'chatToResponses' | 'responsesToChat';
  title: string;
  description: string;
  emptyPatternsMatchAll?: boolean;
}) {
  const { state, dispatch } = useStore();
  const policy = direction === 'chatToResponses'
    ? state.backendConfig?.chatCompletionsToResponsesPolicy
    : state.backendConfig?.responsesToChatCompletionsPolicy;
  const current: ProtocolPolicy = {
    enabled: policy?.enabled ?? false,
    allTargets: policy?.allTargets ?? true,
    targetNames: policy?.targetNames ?? [],
    modelPatterns: policy?.modelPatterns ?? [],
  };
  const targets = [...new Set(state.chains.flatMap(chain => chain.models.map(model => {
    const provider = state.providers.find(item => item.id === model.providerId);
    return provider?.name || model.modelName;
  })))].sort((a, b) => a.localeCompare(b));

  const update = (next: ProtocolPolicy) =>
    dispatch({ type: 'UPDATE_PROTOCOL_POLICY', direction, policy: next });

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <input
          aria-label={`启用${title}`}
          type="checkbox"
          checked={current.enabled}
          onChange={event => update({ ...current, enabled: event.target.checked })}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>

      <div className={`mt-4 space-y-4 ${current.enabled ? '' : 'opacity-55'}`}>
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={current.allTargets}
            disabled={!current.enabled}
            onChange={event => update({ ...current, allTargets: event.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          应用于所有上游目标
        </label>

        {!current.allTargets && (
          <div className="grid gap-2 sm:grid-cols-2">
            {targets.length ? targets.map(target => (
              <label key={target} className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={current.targetNames.includes(target)}
                  disabled={!current.enabled}
                  onChange={event => update({
                    ...current,
                    targetNames: event.target.checked
                      ? [...new Set([...current.targetNames, target])]
                      : current.targetNames.filter(name => name !== target),
                  })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="truncate">{target}</span>
              </label>
            )) : <span className="text-xs text-slate-400">还没有已配置的目标</span>}
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">模型匹配正则，每行一条</span>
          <textarea
            value={current.modelPatterns.join('\n')}
            disabled={!current.enabled}
            onChange={event => update({
              ...current,
              modelPatterns: event.target.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean),
            })}
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:bg-slate-100"
            placeholder={emptyPatternsMatchAll ? '留空表示所有模型' : '例如：^gpt-5-codex$'}
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            {emptyPatternsMatchAll ? '留空时匹配所选目标的所有模型。' : '至少填写一条；策略按客户端请求中的 model 名称匹配。'}
          </span>
        </label>
      </div>
    </section>
  );
}

export default function ProtocolCompatibilitySettings() {
  const { state, dispatch } = useStore();
  const passThrough = state.backendConfig?.passThroughRequestEnabled ?? false;

  return (
    <div className="motion-card overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <ArrowLeftRight size={18} className="text-blue-600" />
        <h3 className="font-semibold text-slate-800">Chat Completions / Responses 兼容路由</h3>
      </div>
      <div className="space-y-4 p-5">
        <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <input
            type="checkbox"
            checked={passThrough}
            onChange={event => dispatch({ type: 'SET_REQUEST_PASSTHROUGH', enabled: event.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
          />
          <span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-900"><Shield size={13} />透传请求体</span>
            <span className="mt-1 block text-xs leading-5 text-amber-800">开启后禁用策略转换；遇到上游不支持的 API 路径时仍会按端点探测结果回退。</span>
          </span>
        </label>

        <div className="grid gap-4 lg:grid-cols-2">
          <PolicyEditor
            direction="chatToResponses"
            title="Chat Completions → Responses"
            description="匹配策略的 Chat 请求优先转成 Responses 请求发送到上游；上游不支持时会继续尝试原协议。"
          />
          <PolicyEditor
            direction="responsesToChat"
            title="Responses → Chat Completions"
            description="匹配策略的 Responses 请求优先转成 Chat Completions 请求；有状态字段和非 function 托管工具会保留给原生 Responses 上游。"
            emptyPatternsMatchAll
          />
        </div>
        <p className="text-xs text-slate-400">配置后请使用左侧“保存”。不命中策略时优先走请求所用的原生端点，并在上游明确不支持该端点时自动切换协议。</p>
      </div>
    </div>
  );
}
