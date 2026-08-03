import { Suspense, useEffect, useState } from 'react';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { StoreProvider, useStore } from './store';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import LoadingOverlay, { LoadingSpinner } from './components/Loading';
import AsyncPageErrorBoundary from './components/AsyncPageErrorBoundary';
import { isKnownAppPath, pageComponents, pageFromPathname, pathForPage } from './pages';

type ThemeMode = 'dark' | 'light';

function initialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem('failover-proxy-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function PageContent() {
  const { state } = useStore();
  const PageComponent = pageComponents[state.currentPage] || pageComponents.dashboard;

  return (
    <div key={state.currentPage} className="page-motion">
      <AsyncPageErrorBoundary pageKey={state.currentPage}>
        {state.pageStatsLoading ? (
          <PageLoading label="正在加载页面状态…" />
        ) : (
          <Suspense key={state.currentPage} fallback={<PageLoading label="正在加载页面内容…" />}>
            <PageComponent key={state.currentPage} />
          </Suspense>
        )}
      </AsyncPageErrorBoundary>
    </div>
  );
}

function PageLoading({ label = '正在加载页面…' }: { label?: string }) {
  return (
    <section className="page-loading-state" aria-live="polite" aria-busy="true">
      <div className="page-loading-state__card">
        <LoadingSpinner size="md" className="text-cyan-400" />
        <div className="page-loading-state__copy">
          <strong>{label}</strong>
          <span>请稍候，正在同步最新数据</span>
        </div>
      </div>
    </section>
  );
}

function AppLayout() {
  const { state, dispatch } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);

  useEffect(() => {
    window.localStorage.setItem('failover-proxy-theme', theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const toggleTheme = () => setTheme(current => current === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    const syncRoute = () => {
      const page = pageFromPathname(window.location.pathname);
      dispatch({ type: 'SET_PAGE', page });
      if (!isKnownAppPath(window.location.pathname)) {
        window.history.replaceState({ page }, '', pathForPage(page));
      }
    };

    syncRoute();
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, [dispatch]);

  const busyLabel =
    state.saveStatus === 'loading' ? '正在加载...' :
    state.saveStatus === 'saving' ? '正在保存...' :
    '';
  const showBusyOverlay = Boolean(busyLabel);

  if (!state.authChecked) {
    return (
      <div data-theme={theme} className="uiverse-login flex min-h-dvh items-center justify-center bg-slate-950 text-sm text-slate-300">
        <div className="flex items-center gap-3">
          <LoadingSpinner size="md" className="text-blue-400" />
          <span>正在检查登录状态...</span>
        </div>
      </div>
    );
  }

  if (!state.authenticated) {
    return <Login theme={theme} onToggleTheme={toggleTheme} />;
  }

  return (
    <div data-theme={theme} className="uiverse-shell min-h-dvh bg-slate-100 md:flex md:h-screen md:overflow-hidden">
      <LoadingOverlay show={showBusyOverlay} label={busyLabel} />
      <div className="hidden md:block">
        <Sidebar theme={theme} onToggleTheme={toggleTheme} />
      </div>

      <header className="uiverse-topbar sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-3 shadow-sm backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100"
          aria-label="打开菜单"
        >
          <Menu size={22} />
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-bold text-slate-900">Failover Proxy</p>
          <p className="truncate text-[11px] text-slate-500">模型故障转移代理</p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="uiverse-theme-toggle flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100"
          aria-label={theme === 'dark' ? '切换亮色模式' : '切换暗色模式'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="关闭菜单"
          />
          <div className="pointer-events-none relative h-full">
            <div className="pointer-events-auto">
              <Sidebar mobile onNavigate={() => setMobileMenuOpen(false)} theme={theme} onToggleTheme={toggleTheme} />
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="pointer-events-auto absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
              aria-label="关闭菜单"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-3 pb-8 transition-all duration-300 sm:p-4 md:p-6 lg:p-8">
          <PageContent />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppLayout />
    </StoreProvider>
  );
}
