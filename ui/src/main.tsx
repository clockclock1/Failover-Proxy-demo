import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LoadingSpinner } from "./components/Loading";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
const ENTRY_RETRY_KEY = 'failover-proxy-entry-retry';

function EntryLoading() {
  return (
    <main className="app-bootstrap" aria-live="polite" aria-busy="true">
      <div className="app-bootstrap__card">
        <LoadingSpinner size="md" className="text-cyan-400" />
        <div>
          <strong>Failover Proxy</strong>
          <p>正在加载管理界面…</p>
        </div>
      </div>
    </main>
  );
}

function EntryLoadFailed() {
  return (
    <main className="app-bootstrap" role="alert">
      <div className="app-bootstrap__card app-bootstrap__card--error">
        <div>
          <strong>管理界面加载失败</strong>
          <p>页面资源未能完整加载，可能是网络短暂波动或刚更新版本。请重新加载后再试。</p>
          <button type="button" onClick={() => window.location.reload()}>重新加载</button>
        </div>
      </div>
    </main>
  );
}

function hasTriedEntryRecovery() {
  try {
    return window.sessionStorage.getItem(ENTRY_RETRY_KEY) === '1';
  } catch {
    return true;
  }
}

function markEntryRecoveryTried() {
  try {
    window.sessionStorage.setItem(ENTRY_RETRY_KEY, '1');
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function clearEntryRecovery() {
  try {
    window.sessionStorage.removeItem(ENTRY_RETRY_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

const isSharedLiveStatus = /^\/share\/live-status\/[^/]+\/?$/.test(window.location.pathname);
const loadApp = () => isSharedLiveStatus ? import('./SharedLiveStatusApp') : import('./App');

root.render(<EntryLoading />);

void loadApp()
  .then(({ default: App }) => {
    clearEntryRecovery();
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  })
  .catch((error) => {
    console.error('Failed to load the management UI entry module.', error);
    if (!hasTriedEntryRecovery()) {
      markEntryRecoveryTried();
      window.setTimeout(() => window.location.reload(), 700);
      return;
    }
    root.render(<EntryLoadFailed />);
  });
