import { Component, type ReactNode } from "react";
import { RotateCcw } from "@/lib/icons";

type Props = { children: ReactNode; title: string; action: string };

/**
 * Catches a failed lazy-route load (flaky connection, new deploy) and offers
 * a reload instead of leaving a blank screen.
 */
export class ChunkBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-bold text-ink">{this.props.title}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="press inline-flex h-12 items-center gap-2 rounded-button bg-brand px-5 text-sm font-bold text-on-brand"
        >
          <RotateCcw className="h-5 w-5" />
          {this.props.action}
        </button>
      </div>
    );
  }
}
