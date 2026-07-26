import { useEffect, useState } from 'react';
import { StoreProvider } from './store';
import LiveStatus, { type SharedLiveStatusData } from './components/LiveStatus';

function sharedTokenFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

function SharedLiveStatusPage() {
  const token = sharedTokenFromPath();
  const [data, setData] = useState<SharedLiveStatusData>({ activeThreads: [] });
  const [error, setError] = useState('');

  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/share/live-status/${encodeURIComponent(token)}`, {
          cache: 'no-store',
          credentials: 'omit',
        });
        if (!response.ok) throw new Error('分享链接无效或已撤销');
        const payload = await response.json();
        if (!stopped) {
          setData({
            activeThreads: Array.isArray(payload.activeThreads) ? payload.activeThreads : [],
            memory: payload.memory || {},
          });
          setError('');
        }
      } catch (cause) {
        if (!stopped) setError(cause instanceof Error ? cause.message : '无法获取实时状态');
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [token]);

  return (
    <div data-theme="dark" className="uiverse-shell min-h-dvh bg-slate-100 md:flex md:h-screen md:overflow-hidden">
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-3 pb-8 transition-all duration-300 sm:p-4 md:p-6 lg:p-8">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : (
            <LiveStatus sharedData={data} />
          )}
        </div>
      </main>
    </div>
  );
}

export default function SharedLiveStatusApp() {
  return (
    <StoreProvider>
      <SharedLiveStatusPage />
    </StoreProvider>
  );
}
