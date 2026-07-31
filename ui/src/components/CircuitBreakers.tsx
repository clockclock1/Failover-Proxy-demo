import { Clock3, ShieldAlert, TimerReset } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import type { ActiveCircuitBreaker } from '../types';
import { cn } from '../utils/cn';
import AnimatedGlyph from './AnimatedGlyph';

const kindLabel: Record<ActiveCircuitBreaker['failureKind'], string> = {
  failure: '上游故障',
  authentication: '认证失败',
  rate_limited: '限流',
  compatibility: '接口不兼容',
  transient: '网络 / 服务暂时故障',
  other: '其他故障',
};

function remainingText(disabledUntil: number, now: number) {
  const seconds = Math.max(0, Math.ceil((disabledUntil - now) / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时 ${minutes % 60} 分`;
}

function earliestRemaining(breakers: ActiveCircuitBreaker[], now: number) {
  if (!breakers.length) return '-';
  return remainingText(Math.min(...breakers.map(item => item.disabledUntil)), now);
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="circuit-breaker-stat motion-card rounded-xl border p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold', tone)}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

export default function CircuitBreakers() {
  const { state } = useStore();
  const [now, setNow] = useState(Date.now());
  const breakers = useMemo(
    () => [...(state.backendStats?.circuitBreakers || [])]
      .filter(item => item.disabledUntil > now)
      .sort((a, b) => a.disabledUntil - b.disabledUntil),
    [state.backendStats?.circuitBreakers, now]
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const totalFailures = breakers.reduce((total, item) => total + item.failures, 0);

  return (
    <div className="space-y-6">
      <section className="circuit-breaker-hero overflow-hidden rounded-2xl border p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="circuit-breaker-live-badge inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold">
              <AnimatedGlyph variant="activity" className="circuit-breaker-live-indicator" />
              实时熔断清单
            </div>
            <h2 className="circuit-breaker-title mt-3 flex items-center gap-3 text-2xl font-bold tracking-tight">
              <ShieldAlert size={26} />
              已熔断模型
            </h2>
            <p className="circuit-breaker-subtitle mt-2 max-w-2xl text-sm">只显示当前仍在冷却期内的目标。倒计时结束后，代理会自动重新尝试该目标。</p>
          </div>
          <div className="circuit-breaker-refresh-badge inline-flex w-fit items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium shadow-sm">
            <AnimatedGlyph variant="refresh" className="circuit-breaker-refresh-indicator live-glyph-active" />
            每秒刷新
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label="当前熔断目标" value={breakers.length.toLocaleString()} sub="仍在冷却期内" tone="text-red-600" />
        <StatCard label="最早恢复" value={earliestRemaining(breakers, now)} sub="距离下一目标可重试" tone="text-amber-600" />
        <StatCard label="累计故障计数" value={totalFailures.toLocaleString()} sub="当前各熔断目标的连续次数" tone="text-slate-800" />
      </section>

      <section className="circuit-breaker-panel motion-card overflow-hidden rounded-xl border shadow-sm">
        <div className="circuit-breaker-panel-header flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="circuit-breaker-panel-title font-semibold">熔断详情</h3>
            <p className="circuit-breaker-panel-note mt-1 text-xs">模型和目标名称来自当前配置；已从配置移除的旧记录会保留原始键，便于排查。</p>
          </div>
          <span className="circuit-breaker-count inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
            <AnimatedGlyph variant="release" className="circuit-breaker-count-indicator" /> {breakers.length} 个生效中
          </span>
        </div>

        {breakers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="circuit-breaker-table-head text-xs shadow-[0_1px_0_#e2e8f0]">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">模型 / 目标</th>
                  <th className="px-5 py-3 text-left font-medium">上游模型</th>
                  <th className="px-5 py-3 text-left font-medium">故障类型</th>
                  <th className="px-5 py-3 text-right font-medium">连续故障</th>
                  <th className="px-5 py-3 text-right font-medium">剩余冷却</th>
                  <th className="px-5 py-3 text-right font-medium">恢复时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {breakers.map((breaker, index) => {
                  const remaining = Math.max(0, breaker.disabledUntil - now);
                  return (
                <tr key={breaker.key} className="circuit-breaker-row table-row-motion" style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}>
                      <td className="max-w-[340px] px-5 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="circuit-breaker-target-icon inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"><ShieldAlert size={15} /></span>
                          <div className="min-w-0">
                            <p className="circuit-breaker-model truncate font-mono text-xs font-semibold">{breaker.model}</p>
                            <p className="circuit-breaker-target mt-0.5 truncate text-xs">{breaker.targetName || breaker.targetBaseUrl || breaker.key}</p>
                          </div>
                        </div>
                      </td>
                      <td className="circuit-breaker-upstream max-w-[220px] px-5 py-3 font-mono text-xs"><span className="block truncate">{breaker.targetModel || '-'}</span></td>
                      <td className="px-5 py-3"><span className="circuit-breaker-kind inline-flex rounded-full border px-2 py-1 text-xs">{kindLabel[breaker.failureKind] || '其他故障'}</span></td>
                      <td className="circuit-breaker-failures px-5 py-3 text-right font-mono text-xs font-semibold">{breaker.failures}</td>
                      <td className="px-5 py-3 text-right"><span className="circuit-breaker-remaining inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs font-semibold"><TimerReset size={13} />{remainingText(breaker.disabledUntil, now)}</span></td>
                      <td className="px-5 py-3 text-right"><span className="circuit-breaker-time inline-flex items-center gap-1.5 font-mono text-xs"><Clock3 size={13} />{new Date(breaker.disabledUntil).toLocaleTimeString('zh-CN', { hour12: false })}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="circuit-breaker-empty flex flex-col items-center justify-center px-5 py-20 text-center">
            <span className="circuit-breaker-empty-icon inline-flex h-14 w-14 items-center justify-center rounded-2xl"><ShieldAlert size={25} /></span>
            <h3 className="circuit-breaker-empty-title mt-4 font-semibold">当前没有模型处于熔断期</h3>
            <p className="circuit-breaker-empty-note mt-1 text-sm">新的熔断发生时会自动显示在这里。</p>
          </div>
        )}
      </section>
    </div>
  );
}
