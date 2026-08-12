"use client";

import { MessageCircle, Route, Sparkles } from "lucide-react";
import { emitOpenWayra } from "@/lib/open-wayra";
import {
  buildCombinedWayraPrompt,
  type LiveAiSuggestionItem,
} from "./live-ai-suggestions";

type Props = {
  suggestions: LiveAiSuggestionItem[];
  destinationName?: string;
  /** Tighter layout inside route preview cards. */
  compact?: boolean;
  /** When true, show a calm empty state instead of hiding the section. */
  showEmptyState?: boolean;
  className?: string;
};

export default function LiveAiSuggestionsBlock({
  suggestions,
  destinationName = "this place",
  compact = false,
  showEmptyState = false,
  className = "",
}: Props) {
  const warnings = suggestions.filter((item) => item.kind === "warning");
  const tips = suggestions.filter((item) => item.kind === "tip");
  const combinedPrompt = buildCombinedWayraPrompt(destinationName, suggestions);
  const hasContent = warnings.length > 0 || tips.length > 0;

  const handleAskWayra = () => {
    emitOpenWayra({ prompt: combinedPrompt, autoSend: !hasContent });
  };

  if (!hasContent && !showEmptyState) return null;

  const pad = compact ? "p-2" : "p-2.5";

  if (!hasContent) {
    return (
      <div
        className={`rounded-xl border border-stone-200/80 bg-stone-50/70 ${pad} ${className}`}
        role="region"
        aria-label="Route insights"
      >
        <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">
          Route insights
        </p>
        <p className="mt-1 text-xs leading-snug text-stone-600">
          No route alerts for this stop. Open Wayra anytime for local tips.
        </p>
        <button
          type="button"
          onClick={handleAskWayra}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-white px-3 py-1.5 text-xs font-semibold text-primary hover:bg-teal-50/80"
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Ask Wayra about this place
        </button>
      </div>
    );
  }

  return (
    <div
      className={`space-y-2 ${className}`}
      role="region"
      aria-label="Route insights"
    >
      {warnings.length > 0 ? (
        <section
          className={`rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50/90 via-white to-white shadow-sm ${pad}`}
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <Route className="h-3.5 w-3.5" aria-hidden />
            </span>
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900">
              Route alert
            </p>
          </div>
          <ul className="space-y-1">
            {warnings.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-amber-200/80 bg-white/80 px-2.5 py-2 text-xs leading-snug text-amber-950"
              >
                {item.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tips.length > 0 ? (
        <section
          className={`rounded-xl border border-teal-100/90 bg-gradient-to-br from-[#F0FDFA]/80 via-white to-white shadow-sm ${pad}`}
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            </span>
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
              Trip tips
            </p>
          </div>
          <ul className="space-y-1">
            {tips.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-stone-100 bg-white/90 px-2.5 py-2 text-xs leading-snug text-stone-800"
              >
                {item.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <button
        type="button"
        onClick={handleAskWayra}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/25 bg-white px-3 py-2 text-xs font-semibold text-primary hover:bg-[#F0FDFA]"
      >
        <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Ask Wayra about this trip
      </button>
    </div>
  );
}
