import { useEffect, useState } from 'react';
import { Clock3, Server } from 'lucide-react';
import { useStore } from '../store';
import type { ActiveThread } from '../types';
import { cn } from '../utils/cn';
import AnimatedGlyph from './AnimatedGlyph';

const phaseMeta: Record<string, { label: string; className: string }> = {
  starting: { label: '创建中', className: 'border-slate-200 bg-slate-50 text-slate-600' },
  calling: { label: '调用中', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  'context-retrying': { label: '上下文压缩重试', className: 'border-violet-200 bg-violet-50 text-violet-700' },
  retrying: { label: '重试中', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  streaming: { label: '流式转发', className: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
  skipped: { label: '已跳过', className: 'border-slate-200 bg-slate-50 text-slate-600' },
  'failed-target': { label: '目标失败', className: 'border-red-200 bg-red-50 text-red-700' },
  completed: { label: '已响应', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  failed: { label: '失败', className: 'border-red-200 bg-red-50 text-red-700' },
  'release-wait': { label: '已响应', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
};

function elapsedText(startedAt: number, now: number) {
  if (!startedAt) return '0s';
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function formatBytes(value?: number) {
  const bytes = Number(value) || 0;
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** unitIndex).toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

const memoryLabels: Record<string, string> = {
  platform: '操作系统',
  pid: '进程 ID',
  primaryMetric: '首页指标字段',
  primaryMetricLabel: '首页指标含义',
  workingSetBytes: '工作集（当前驻留物理内存）',
  peakWorkingSetBytes: '峰值工作集',
  privateCommitBytes: '私有提交内存',
  physicalFootprintBytes: '物理足迹（macOS 内存压力计入值）',
  rssBytes: '驻留内存（RSS）',
  pssBytes: '比例驻留内存（PSS，已分摊共享页）',
  privateResidentBytes: '私有驻留内存',
  peakRssBytes: '峰值驻留内存',
  swapBytes: '已换出内存',
  virtualBytes: '虚拟地址空间',
  dataBytes: '数据段',
  collectionError: '采样说明',
};

const runtimeStateMemoryLabels: Record<string, string> = {
  circuitBreakers: '熔断记录',
  roundRobin: '轮询记录',
  responseHistory: 'Responses 会话记录',
  modelStatistics: '模型统计（含一天历史）',
  providerHealthCache: '健康检查缓存',
  modelSourceCache: '动态模型缓存',
  activeThreads: '活动请求线程',
  requestLogs: '请求日志缓存',
  adminSessions: '管理登录会话',
};

const runtimeMemoryPartLabels: Record<string, string> = {
  contentBytes: '内容',
  hashBucketBytes: '哈希桶',
  lockAndShardBytes: '锁与分片',
  containerBytes: '数组/容器',
};

type RuntimeStateMemoryItem = {
  entries?: number;
  contentBytes?: number;
  hashBucketBytes?: number;
  lockAndShardBytes?: number;
  containerBytes?: number;
  capacity?: number;
  estimatedBytes?: number;
};

function isRuntimeStateMemoryItem(value: unknown): value is RuntimeStateMemoryItem {
  return Boolean(value)
    && typeof value === 'object'
    && typeof (value as RuntimeStateMemoryItem).estimatedBytes === 'number';
}

function runtimeMemoryNumber(value: unknown, key: string) {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  return typeof item[key] === 'number' ? item[key] as number : undefined;
}

function runtimeMemoryText(value: unknown, key: string) {
  if (!value || typeof value !== 'object') return '';
  const item = value as Record<string, unknown>;
  return typeof item[key] === 'string' ? item[key] as string : '';
}

function formatMemoryValue(key: string, value: unknown) {
  if (typeof value === 'number' && key.toLowerCase().includes('bytes')) {
    return formatBytes(value);
  }
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') return value || '-';
  if (value === null || value === undefined) return '-';
  return JSON.stringify(value);
}

function PhasePill({ phase }: { phase: string }) {
  const meta = phaseMeta[phase] || { label: phase || '未知', className: 'border-slate-200 bg-slate-50 text-slate-600' };
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium', meta.className)}>
      {meta.label}
    </span>
  );
}

function ThreadCard({ thread, now, index }: { thread: ActiveThread; now: number; index: number }) {
  const targetLabel = thread.targetModel || thread.targetName || thread.targetBaseUrl || '等待目标';
  const attemptLabel = thread.compressionAttempt > 0
    ? `${thread.attempt || 0} 次（上下文压缩 ${thread.compressionAttempt} / ${thread.maxCompressionAttempts || 32}）`
    : `${thread.attempt || 0}${thread.maxAttempts ? ` / ${thread.maxAttempts}` : ''}`;

  return (
    <div className="motion-card rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md" style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <AnimatedGlyph variant="threads" className="text-blue-600" />
            </span>
            <h3 className="truncate font-semibold text-slate-800">{thread.chainName}</h3>
            <PhasePill phase={thread.phase} />
            <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-xs text-slate-500">
              #{thread.slot || thread.id}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{thread.status}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Clock3 size={13} />
            {elapsedText(thread.startedAt, now)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-400">请求模型</p>
          <p className="mt-1 truncate font-mono text-sm text-slate-700">{thread.requestedModel || '-'}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-400">正在尝试</p>
          <p className="mt-1 truncate font-mono text-sm text-blue-700">{targetLabel}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-400">尝试次数</p>
          <p className="mt-1 font-mono text-sm text-slate-700">
            {attemptLabel}
          </p>
        </div>
      </div>

      {(thread.targetName || thread.targetBaseUrl || thread.failedModels.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {thread.targetName && <span className="rounded-md bg-slate-100 px-2 py-1">{thread.targetName}</span>}
          {thread.targetBaseUrl && <span className="rounded-md bg-slate-100 px-2 py-1 font-mono">{thread.targetBaseUrl}</span>}
          {thread.failedModels.map(model => (
            <span key={model} className="rounded-md bg-red-50 px-2 py-1 font-mono text-red-600">{model}</span>
          ))}
        </div>
      )}

      {thread.attemptErrors.length > 0 && (
        <div className="live-attempt-errors mt-4 rounded-lg border border-red-100 bg-red-50/60 p-3">
          <p className="text-xs font-semibold text-red-700">转移原因</p>
          <div className="mt-2 space-y-2">
            {thread.attemptErrors.map((item, attemptIndex) => (
              <div key={`${item.target}-${item.attempt || 0}-${attemptIndex}`} className="live-attempt-error-item rounded-md bg-white px-3 py-2 text-xs text-red-700">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{item.target || 'target'}</span>
                  {item.attempt !== undefined && <span className="text-red-400">#{item.attempt}</span>}
                  {item.status ? <span className="live-attempt-status rounded bg-red-100 px-1.5 py-0.5 font-mono">{item.status}</span> : null}
                </div>
                <p className="mt-1 break-words text-red-600">{item.message}</p>
                {item.detail && item.detail !== item.message && (
                  <p className="mt-1 line-clamp-2 break-words font-mono text-[11px] text-red-400">{item.detail}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export type SharedLiveStatusData = {
  activeThreads: ActiveThread[];
  memory?: Record<string, unknown>;
  runtimeStateMemory?: Record<string, RuntimeStateMemoryItem | string>;
};

export default function LiveStatus({ sharedData }: { sharedData?: SharedLiveStatusData }) {
  const { state } = useStore();
  const isShared = Boolean(sharedData);
  const [memoryExpanded, setMemoryExpanded] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [shareEnabled, setShareEnabled] = useState(false);
  const now = Date.now();
  const threads = sharedData?.activeThreads || state.activeThreads;
  const activeChains = new Set(threads.map(thread => thread.chainName)).size;
  const memory = sharedData?.memory || state.backendStats?.memory;
  const runtimeStateMemory = sharedData?.runtimeStateMemory || state.backendStats?.runtimeStateMemory;
  const runtimeStateEntries = Object.entries(runtimeStateMemory || {})
    .filter(([, value]) => isRuntimeStateMemoryItem(value));
  const runtimeStateNote = typeof runtimeStateMemory?.estimateNote === 'string'
    ? runtimeStateMemory.estimateNote
    : '';
  const memoryEntries = Object.entries(memory || {});
  const primaryMetric = memory?.primaryMetric;
  const primaryMetricValue = primaryMetric
    ? memory?.[primaryMetric as keyof typeof memory]
    : memory?.workingSetBytes;
  const primaryMemory = typeof primaryMetricValue === 'number' ? primaryMetricValue : undefined;
  const primaryMemoryLabel = memory?.primaryMetricLabel || '当前驻留内存';

  const loadShares = async () => {
    if (isShared || !state.adminSession) return;
    const response = await fetch('/api/shares/live-status', {
      headers: { 'x-admin-session': state.adminSession },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('读取分享链接失败');
    const payload = await response.json();
    setShareEnabled(Boolean(payload.enabled));
    setShareUrl(payload.path ? `${window.location.origin}${String(payload.path)}` : '');
  };

  useEffect(() => {
    if (isShared) return;
    void loadShares().catch(() => {
      setShareEnabled(false);
      setShareUrl('');
    });
  }, [isShared, state.adminSession]);

  const shareLiveStatus = async () => {
    if (!state.adminSession) return;
    setShareStatus('正在创建分享链接…');
    try {
      const response = await fetch('/api/shares/live-status', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-session': state.adminSession,
        },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('创建分享链接失败');
      const payload = await response.json();
      const url = `${window.location.origin}${String(payload.path || '')}`;
      if (!url || !payload.path) throw new Error('分享链接无效');
      setShareUrl(url);
      await loadShares();
      try {
        await navigator.clipboard.writeText(url);
        setShareStatus('已复制永久只读实时状态链接');
      } catch {
        setShareStatus('链接已生成，请手动复制');
      }
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : '创建分享链接失败');
    }
  };

  const revokeShare = async () => {
    if (!state.adminSession) return;
    setShareStatus('正在撤销分享链接…');
    try {
      const response = await fetch('/api/shares/live-status/revoke', {
        method: 'POST',
        headers: { 'x-admin-session': state.adminSession },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('撤销分享链接失败');
      await loadShares();
      setShareStatus('分享链接已撤销');
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : '撤销分享链接失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            <AnimatedGlyph variant="activity" />
            Live Threads
          </div>
          <h2 className="mt-3 text-2xl font-bold text-slate-800">实时状况</h2>
          <p className="mt-1 text-slate-500">查看代理 API 当前创建的线程、正在尝试的目标模型和进程内存占用。</p>
        </div>
        <div className="flex w-full max-w-xl flex-col items-end gap-2 self-start xl:w-auto xl:self-auto">
          {isShared ? (
            <div className="inline-flex w-fit items-center gap-2 self-start rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 xl:self-auto">
              <AnimatedGlyph variant="refresh" />
              自动刷新
            </div>
          ) : <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void shareLiveStatus()}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <AnimatedGlyph variant="chains" />
              {shareEnabled ? '轮换分享凭证' : '创建分享凭证'}
            </button>
            {shareEnabled && (
              <button
                type="button"
                onClick={() => void revokeShare()}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
              >
                <AnimatedGlyph variant="release" />
                撤销
              </button>
            )}
            <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <AnimatedGlyph variant="refresh" />
              自动刷新
            </div>
          </div>
          {shareStatus && <p className="max-w-sm text-right text-xs text-slate-500">{shareStatus}</p>}
          {shareUrl && (
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              className="max-w-sm truncate text-right font-mono text-xs text-blue-600 underline"
              title={shareUrl}
            >
              {shareUrl}
            </a>
          )}
          {shareEnabled && (
            <div className="w-full rounded-lg border border-slate-200 bg-white p-2 text-left text-xs text-slate-600">
              <p className="font-medium text-slate-700">永久分享凭证已启用</p>
              <p className="mt-1 text-slate-400">凭证已持久化，可跨服务重启使用；轮换或撤销会立刻使旧链接失效。</p>
            </div>
          )}
          </>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="motion-card rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">活动线程</span>
            <AnimatedGlyph variant="threads" className="text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-800">{threads.length}</p>
        </div>
        <div className="motion-card rounded-xl border border-slate-200 bg-white p-4" style={{ animationDelay: '45ms' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">涉及链路</span>
            <AnimatedGlyph variant="chains" className="text-violet-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-800">{activeChains}</p>
        </div>
        <button
          type="button"
          onClick={() => setMemoryExpanded(expanded => !expanded)}
          aria-expanded={memoryExpanded}
          className="motion-card cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-emerald-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
          style={{ animationDelay: '90ms' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">内存占用</span>
            <AnimatedGlyph variant="memory" className="text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-800">{formatBytes(primaryMemory)}</p>
          <p className="mt-1 text-xs text-slate-400">{primaryMemoryLabel}</p>
        </button>
        <div
          className={cn(
            'live-memory-panel md:col-span-3',
            memoryExpanded && 'live-memory-panel-open'
          )}
          aria-hidden={!memoryExpanded}
        >
          <div className="live-memory-panel-inner">
            <div className="motion-card rounded-xl border border-slate-200 bg-white p-4" style={{ animationDelay: '115ms' }}>
              <div className="mb-4 border-b border-slate-100 pb-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">运行时状态占用估算</p>
                    <p className="mt-1 text-xs text-slate-400">可直接看出哪类缓存或状态记录正在增长。</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-xs text-slate-500">
                    {runtimeStateEntries.reduce((total, [, item]) => total + (item.entries || 0), 0).toLocaleString()} 条
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {runtimeStateEntries.map(([key, item]) => (
                    <div key={key} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs text-slate-400">{runtimeStateMemoryLabels[key] || key}</p>
                      <p className="mt-1 font-mono text-sm font-semibold text-slate-700">{formatBytes(item.estimatedBytes)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {(item.entries || 0).toLocaleString()} 条
                        {typeof item.capacity === 'number' && ` · ${item.capacity.toLocaleString()} 槽`}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-slate-200 pt-2 text-[11px] text-slate-500">
                        {Object.entries(runtimeMemoryPartLabels).map(([part, label]) => (
                          <span key={part}>{label} {formatBytes(item[part as keyof RuntimeStateMemoryItem] as number)}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!runtimeStateEntries.length && (
                    <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">暂无运行时状态数据</div>
                  )}
                </div>
                {runtimeStateNote && <p className="mt-3 text-[11px] text-slate-400">{runtimeStateNote}</p>}
              </div>
              <div className="mb-4 border-b border-slate-100 pb-4">
                <p className="text-sm font-semibold text-slate-700">进程剩余项与不可直接采样项</p>
                <p className="mt-1 text-xs text-slate-400">这些项目必须如实标记为“可计算的剩余量”或“上游库未公开”，不能误判成某张表泄露。</p>
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">未归类进程内存</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-slate-700">
                      {formatBytes(runtimeMemoryNumber(runtimeStateMemory?.processRemainder, 'unattributedBytes'))}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {runtimeMemoryText(runtimeStateMemory?.processRemainder, 'processMetricLabel')}：{formatBytes(runtimeMemoryNumber(runtimeStateMemory?.processRemainder, 'processBytes'))}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">{runtimeMemoryText(runtimeStateMemory?.processRemainder, 'note')}</p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">网络缓冲 / 连接池</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-slate-700">未公开字节数</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      当前流 {runtimeMemoryNumber(runtimeStateMemory?.networkBuffers, 'activeStreamCount') || 0} · 每主机最多空闲 {runtimeMemoryNumber(runtimeStateMemory?.networkBuffers, 'maxIdleConnectionsPerHost') || 0} 条 · {runtimeMemoryNumber(runtimeStateMemory?.networkBuffers, 'idleTimeoutSeconds') || 0} 秒
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">{runtimeMemoryText(runtimeStateMemory?.networkBuffers, 'note')}</p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">分配器碎片</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-slate-700">无法跨平台精确读取</p>
                    <p className="mt-1 text-[11px] text-slate-500">{runtimeMemoryText(runtimeStateMemory?.allocator, 'name')}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{runtimeMemoryText(runtimeStateMemory?.allocator, 'note')}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {memoryEntries.map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">{memoryLabels[key] || key}</p>
                    <p className="mt-1 break-words font-mono text-sm font-semibold text-slate-700">
                      {formatMemoryValue(key, value)}
                    </p>
                    <p className="mt-1 break-all font-mono text-[11px] text-slate-400">{key}</p>
                  </div>
                ))}
                {!memoryEntries.length && (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                    暂无内存数据
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={cn('live-status-thread-area space-y-3', memoryExpanded && 'live-status-thread-area-memory-open')}>
        {threads.map((thread, index) => (
          <ThreadCard key={thread.id} thread={thread} now={now} index={index} />
        ))}
        {!threads.length && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
            <Server size={36} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">当前没有活动线程</p>
          </div>
        )}
      </div>
    </div>
  );
}
