"use client";

import { AlertTriangle, MessageCircle, Sparkles } from "lucide-react";
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
  className?: string;
};

function SuggestionList({
  items,
  variant,
}: {
  items: LiveAiSuggestionItem[];
  variant: "warning" | "tip";
}) {
  const isWarning = variant === "warning";

  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li
          key={item.id}
          className={
            isWarning
              ? "flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2"
              : "rounded-lg border border-teal-100/90 bg-white/90 px-2.5 py-2"
          }
        >
          {isWarning ? (
            <AlertTriangle
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700"
              aria-hidden
            />
          ) : null}
          <p
            className={
              isWarning
                ? "text-xs leading-snug text-amber-950"
                : "text-xs leading-snug text-stone-800"
            }
          >
            {item.message}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function LiveAiSuggestionsBlock({
  suggestions,
  destinationName = "this place",
  compact = false,
  className = "",
}: Props) {
  const warnings = suggestions.filter((item) => item.kind === "warning");
  const tips = suggestions.filter((item) => item.kind === "tip");
  const combinedPrompt = buildCombinedWayraPrompt(destinationName, suggestions);

  const handleAskWayra = () => {
    emitOpenWayra({ prompt: combinedPrompt });
  };

  return (
    <div
      className={`space-y-2 ${className}`}
      role="region"
      aria-label="Wayra AI suggestions"
    >
      {warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 p-2.5 shadow-[0_1px_8px_rgba(245,158,11,0.12)]">
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            </span>
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900">
              Important · Wayra flagged
            </p>
          </div>
          <SuggestionList items={warnings} variant="warning" />
        </div>
      ) : null}

      {tips.length > 0 ? (
        <div
          className={`rounded-xl border border-[#99F6E4]/80 bg-gradient-to-br from-[#F0FDFA] via-white to-[#ECFDF5] shadow-[0_1px_8px_rgba(15,118,110,0.08)] ${compact ? "p-2" : "p-2.5"}`}
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0F766E]/10 text-[#0F766E]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            </span>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#0F766E]">
              Wayra · AI suggested
            </p>
          </div>
          <SuggestionList items={tips} variant="tip" />
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleAskWayra}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#0F766E]/25 bg-white px-3 py-2 text-xs font-semibold text-[#0F766E] hover:bg-[#F0FDFA]"
      >
        <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Ask Wayra about this trip
      </button>
    </div>
  );
}
