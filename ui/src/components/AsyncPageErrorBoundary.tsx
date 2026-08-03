import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  pageKey: string;
};

type State = {
  hasError: boolean;
};

export default class AsyncPageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Failed to load page module.', error, info.componentStack);
  }

  componentDidUpdate(previousProps: Props) {
    if (previousProps.pageKey !== this.props.pageKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <section className="flex min-h-72 items-center justify-center text-center">
        <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
          <h2 className="text-base font-bold">页面加载失败</h2>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            页面资源未能完整加载。请重新加载页面；若刚更新服务，请稍后重试。
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            重新加载
          </button>
        </div>
      </section>
    );
  }
}
