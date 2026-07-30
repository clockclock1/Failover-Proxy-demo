import { lazy, type ComponentType } from 'react';
import type { Page } from '../types';

export const pageComponents: Record<Page, ComponentType> = {
  dashboard: lazy(() => import('./DashboardPage')),
  providers: lazy(() => import('./ProvidersPage')),
  'model-tests': lazy(() => import('./ModelTestsPage')),
  chains: lazy(() => import('./FailoverChainsPage')),
  'model-stats': lazy(() => import('./ModelStatsPage')),
  endpoints: lazy(() => import('./ProxyEndpointsPage')),
  'live-status': lazy(() => import('./LiveStatusPage')),
  'circuit-breakers': lazy(() => import('./CircuitBreakersPage')),
  logs: lazy(() => import('./LogsPage')),
};

export const pagePaths: Record<Page, string> = {
  dashboard: '/ui/dashboard',
  providers: '/ui/providers',
  'model-tests': '/ui/model-tests',
  chains: '/ui/chains',
  'model-stats': '/ui/model-stats',
  endpoints: '/ui/endpoints',
  'live-status': '/ui/live-status',
  'circuit-breakers': '/ui/circuit-breakers',
  logs: '/ui/logs',
};

const pageIds = Object.keys(pagePaths) as Page[];

function normalizePath(pathname: string) {
  const clean = pathname.replace(/\/+$/, '');
  return clean || '/';
}

export function pathForPage(page: Page) {
  return pagePaths[page] || pagePaths.dashboard;
}

export function pageFromPathname(pathname: string): Page {
  const clean = normalizePath(pathname);
  // `/ui`（无尾随路径）等价于 dashboard 首页
  if (clean === '/ui' || clean === '/ui/index.html') return 'dashboard';
  if (clean === '/' || clean === '/index.html') return 'dashboard';
  return pageIds.find(page => pagePaths[page] === clean) || 'dashboard';
}

export function isKnownAppPath(pathname: string) {
  const clean = normalizePath(pathname);
  // `/ui`（无尾随路径）是 React UI 的入口目录
  if (clean === '/ui' || clean === '/ui/index.html') return true;
  return clean === '/' || clean === '/index.html' || pageIds.some(page => pagePaths[page] === clean);
}
