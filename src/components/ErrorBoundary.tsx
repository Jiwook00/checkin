import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-6">
          <p className="text-sm font-medium text-stone-700">
            문제가 발생했습니다
          </p>
          <p className="text-xs text-stone-400">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700"
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
