"use client";

import {
  ThIconChevronLeft,
  ThIconSearch,
} from "@/components/lounge/hub/HubIcons";
import { HubSearchResults, type HubSearchResultsProps } from "@/components/lounge/hub/HubSearchResults";

const BG = "#0f3460";
const SURFACE = "#2d4060";
const BORDER_SUB = "rgba(255,255,255,0.08)";
const TH_MUTED = "#9ca3af";

export type HubSearchOverlayProps = HubSearchResultsProps & {
  onSearchQueryChange: (q: string) => void;
  onClose: () => void;
};

export function HubSearchOverlay({
  searchQuery,
  onSearchQueryChange,
  onClose,
  ...resultsProps
}: HubSearchOverlayProps) {
  const handleClose = () => {
    onClose();
    onSearchQueryChange("");
  };

  return (
    <div
      className="fixed inset-0 z-[360] flex min-h-0 flex-col"
      style={{ background: BG }}
    >
      <div
        className="flex shrink-0 items-center gap-2 px-3 py-3"
        style={{ borderBottom: `0.5px solid ${BORDER_SUB}` }}
      >
        <button
          type="button"
          aria-label="Close search"
          className="flex h-9 w-9 items-center justify-center text-white"
          onClick={handleClose}
        >
          <ThIconChevronLeft size={22} className="text-white" />
        </button>
        <div
          className="flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-2"
          style={{ background: SURFACE }}
        >
          <span className="inline-flex shrink-0" style={{ color: TH_MUTED }} aria-hidden>
            <ThIconSearch size={18} className="text-current" />
          </span>
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search chats, people, and groups…"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
          {searchQuery ? (
            <button
              type="button"
              className="text-slate-400"
              onClick={() => onSearchQueryChange("")}
              aria-label="Clear"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 custom-scrollbar overflow-y-auto overscroll-contain px-2 py-2">
        <HubSearchResults
          tone="overlay"
          searchQuery={searchQuery}
          onDismiss={handleClose}
          {...resultsProps}
        />
      </div>
    </div>
  );
}
