import type { ReactNode } from 'react';
import {
  Activity,
  ShieldAlert,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  LayoutDashboard,
  Link2,
  Moon,
  ScrollText,
  Server,
  Sun,
  TestTube,
} from 'lucide-react';
import { usePageNavigation } from '../hooks/usePageNavigation';
import { useStore } from '../store';
import type { Page } from '../types';
import { cn } from '../utils/cn';
import AnimatedGlyph from './AnimatedGlyph';

export const navItems: { page: Page; label: string; icon: ReactNode }[] = [
  { page: 'dashboard', label: '仪表盘', icon: <LayoutDashboard size={20} /> },
  { page: 'providers', label: '模型提供商', icon: <Server size={20} /> },
  { page: 'model-tests', label: '模型测试', icon: <TestTube size={20} /> },
  { page: 'chains', label: '故障转移链', icon: <GitBranch size={20} /> },
  { page: 'model-stats', label: '模型统计', icon: <BarChart3 size={20} /> },
  { page: 'endpoints', label: '代理端点', icon: <Link2 size={20} /> },
  { page: 'live-status', label: '实时状况', icon: <Activity size={20} /> },
  { page: 'circuit-breakers', label: '已熔断模型', icon: <ShieldAlert size={20} /> },
  { page: 'logs', label: '请求日志', icon: <ScrollText size={20} /> },
];

export default function Sidebar({
  mobile = false,
  onNavigate,
  theme,
  onToggleTheme,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}) {
  const { state, dispatch, loadConfig, saveConfig, logout } = useStore();
  const navigateToPage = usePageNavigation();
  const collapsed = state.sidebarCollapsed;
  const busy = state.saveStatus === 'loading' || state.saveStatus === 'saving';
  const isCollapsed = !mobile && collapsed;
  const hasUnsavedChanges = state.hasUnsavedChanges;

  return (
    <aside
      className={cn(
        'uiverse-sidebar h-dvh bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col transition-all duration-300 border-r border-slate-700/50 flex-shrink-0',
        isCollapsed ? 'w-16' : 'w-64',
        mobile && 'w-[82vw] max-w-80 shadow-2xl'
      )}
    >
      <div className="flex h-16 items-center justify-center gap-3 border-b border-slate-700/50 px-4">
        {!isCollapsed && (
          <div className="w-full overflow-hidden text-center">
            <h1 className="whitespace-nowrap text-sm font-bold">Failover Proxy</h1>
            <p className="whitespace-nowrap text-[10px] text-slate-400">模型故障转移代理</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.map(({ page, label, icon }) => (
          <button
            key={page}
            onClick={() => {
              navigateToPage(page);
              onNavigate?.();
            }}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-300 hover:translate-x-0.5',
              state.currentPage === page
                ? 'bg-blue-600/20 text-blue-400 shadow-lg shadow-blue-500/5'
                : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
            )}
          >
            <span className="flex-shrink-0">{icon}</span>
            {!isCollapsed && <span className="whitespace-nowrap">{label}</span>}
          </button>
        ))}
      </nav>

      {!isCollapsed && (
        <div className="space-y-2 border-t border-slate-700/50 px-3 py-3">
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/60 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? '亮色模式' : '暗色模式'}
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => loadConfig().catch(() => undefined)}
              disabled={busy}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-700/70 px-2 py-2 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              <AnimatedGlyph variant="load" className={busy ? 'live-glyph-active' : ''} />
              加载
            </button>
            <button
              onClick={() => saveConfig().catch(() => undefined)}
              disabled={busy}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs text-white disabled:opacity-50',
                hasUnsavedChanges
                  ? 'bg-amber-500 hover:bg-amber-400 shadow-sm shadow-amber-500/20'
                  : 'bg-blue-600 hover:bg-blue-500'
              )}
            >
              <AnimatedGlyph variant="save" className={hasUnsavedChanges ? 'live-glyph-active' : ''} />
              保存
            </button>
            <button
              onClick={() => logout().catch(() => undefined)}
              disabled={busy}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2 py-2 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              <AnimatedGlyph variant="logout" />
              退出
            </button>
          </div>
          <p className={cn(
            'min-h-4 text-[10px]',
            state.saveStatus === 'error' ? 'text-red-300' :
            hasUnsavedChanges ? 'text-amber-300' :
            state.saveStatus === 'saved' ? 'text-emerald-300' : 'text-slate-500'
          )}>
            {state.saveStatus === 'loading' && '正在加载配置...'}
            {state.saveStatus === 'saving' && '正在保存配置...'}
            {state.saveStatus === 'saved' && !hasUnsavedChanges && '配置已保存'}
            {state.saveStatus === 'error' && (state.saveError || '操作失败')}
            {hasUnsavedChanges && state.saveStatus !== 'loading' && state.saveStatus !== 'saving' && state.saveStatus !== 'error' && '配置已修改，请点击保存'}
            {state.saveStatus === 'idle' && !hasUnsavedChanges && (state.configLoaded ? '已登录并连接后端' : '等待加载配置')}
          </p>
        </div>
      )}

      {!mobile && (
      <div className="border-t border-slate-700/50 p-2">
        {isCollapsed && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="mb-2 flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-white"
            aria-label={theme === 'dark' ? '切换亮色模式' : '切换暗色模式'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-white"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>收起侧栏</span></>}
        </button>
      </div>
      )}
    </aside>
  );
}
