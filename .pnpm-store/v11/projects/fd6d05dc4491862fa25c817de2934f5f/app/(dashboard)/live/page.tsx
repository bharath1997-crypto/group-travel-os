"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, useState } from "react";
import LivePageLoadError from "./LivePageLoadError";
import { loadLivePageClientModule } from "./live-page-loader";

function LivePageLoading() {
  return (
    <div className="fixed inset-0 z-[1] flex items-center justify-center bg-[#F8FAFC] text-sm font-medium text-[#5F665F]">
      Loading Live…
    </div>
  );
}

const LivePageClient = dynamic(() => loadLivePageClientModule(), {
  ssr: false,
  loading: LivePageLoading,
});

type ErrorBoundaryState = {
  failed: boolean;
  message: string | null;
};

class LivePageErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false, message: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error);
    return { failed: true, message };
  }

  render() {
    if (this.state.failed) {
      return (
        <LivePageLoadError
          detail={this.state.message}
          onRetry={() => {
            this.setState({ failed: false, message: null });
            this.props.onRetry();
          }}
        />
      );
    }
    return this.props.children;
  }
}

export default function LivePage() {
  const [loadKey, setLoadKey] = useState(0);

  return (
    <LivePageErrorBoundary onRetry={() => setLoadKey((key) => key + 1)}>
      <LivePageClient key={loadKey} />
    </LivePageErrorBoundary>
  );
}
