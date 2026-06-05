import React from "react";
import { reportClientError } from "../errorReporting";
import "../styles/crash.css";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * 应用顶层崩溃兜底（REQ-OBS-001）。
 * 捕获 React 渲染树内的同步错误，上报到 /api/client-errors，
 * 并展示 sage 风格降级页而不是白屏，给用户一个"刷新重试"出口。
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const componentStack = info?.componentStack ?? "";
    reportClientError({
      kind: "crash",
      message: `${error.name}: ${error.message}\n${componentStack}`.slice(0, 2000),
      page: typeof window !== "undefined" ? window.location?.pathname : undefined,
    });
  }

  private handleReload = (): void => {
    try {
      window.location.reload();
    } catch {
      // ignore
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="app-crash-screen" role="alert">
          <div className="app-crash-card">
            <div className="app-crash-mark">🌱</div>
            <h1 className="app-crash-title">小宝记遇到了一点小状况</h1>
            <p className="app-crash-text">
              页面卡住了，刷新一下通常就好。你记录的内容都安全保存在家庭后端，不会丢。
            </p>
            <button type="button" className="app-crash-button" onClick={this.handleReload}>
              刷新重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
