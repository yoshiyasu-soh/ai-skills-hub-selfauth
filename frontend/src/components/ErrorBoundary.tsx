import { Component, type ErrorInfo, type ReactNode } from "react";
import LogoMark from "./LogoMark";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg px-4 text-center">
          <LogoMark className="mb-2 h-9 w-9 opacity-60" />
          <p className="text-lg font-semibold text-ink font-display">予期しないエラーが発生しました</p>
          <p className="text-sm text-ink-secondary">
            お手数ですが、下のボタンからページを再読み込みしてください。
          </p>
          <a
            href="/"
            className="mt-2 inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-semibold text-cta-text shadow-sm hover:bg-cta-hover"
          >
            ホームに戻る
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}
