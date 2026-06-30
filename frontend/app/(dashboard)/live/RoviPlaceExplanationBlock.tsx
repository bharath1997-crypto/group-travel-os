"use client";

import { Sparkles } from "lucide-react";
import type { LocationContextTemplate } from "./live-location-context";
import type { RoviPlaceExplanation } from "./live-rovi";

const TEAL = "#0F766E";

type Props = {
  showAskButton: boolean;
  showSafetyActions: boolean;
  template: LocationContextTemplate | null;
  loading: boolean;
  explanation: RoviPlaceExplanation | null;
  error: string | null;
  onAskRovi: () => void;
  onSearchNearMe: () => void;
  onChangeDestination: () => void;
  onPlanTrip: () => void;
  onContinueAnyway: () => void;
  showContinueAnyway?: boolean;
};

export default function RoviPlaceExplanationBlock({
  showAskButton,
  showSafetyActions,
  template,
  loading,
  explanation,
  error,
  onAskRovi,
  onSearchNearMe,
  onChangeDestination,
  onPlanTrip,
  onContinueAnyway,
  showContinueAnyway = true,
}: Props) {
  const activeCopy = explanation ?? null;
  const showAiPanel = loading || Boolean(activeCopy) || Boolean(error);

  if (!template && !showAskButton && !showSafetyActions) return null;

  return (
    <div className="mt-4 space-y-3">
      {template ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2.5 text-sm leading-snug text-amber-950">
          <p className="font-medium">{template.summary}</p>
          <p className="mt-1 text-amber-900/90">{template.recommendation}</p>
        </div>
      ) : null}

      {showAskButton && !showAiPanel ? (
        <button
          type="button"
          onClick={onAskRovi}
          className="inline-flex items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50/80 px-3 py-1.5 text-xs font-semibold text-[#0F766E] hover:bg-teal-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Ask Rovi AI
        </button>
      ) : null}

      {showAiPanel ? (
        <div className="rounded-xl border border-white/60 bg-white/70 p-3 shadow-sm backdrop-blur-md">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#0F766E]">
            <Sparkles className="h-3.5 w-3.5" />
            Rovi AI
          </div>

          {loading ? (
            <div className="space-y-2 py-1">
              <div className="h-3 w-full animate-pulse rounded bg-stone-200" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-stone-200" />
              <p className="text-xs text-stone-500">Reviewing your place context…</p>
            </div>
          ) : null}

          {!loading && activeCopy ? (
            <div className="space-y-2 text-sm leading-snug text-stone-700">
              <p>{activeCopy.summary}</p>
              <p className="text-stone-600">{activeCopy.recommendation}</p>
            </div>
          ) : null}

          {!loading && !activeCopy && error ? (
            <p className="text-sm leading-snug text-stone-600">{error}</p>
          ) : null}
        </div>
      ) : null}

      {showSafetyActions ? (
        <div className="grid grid-cols-2 gap-2">
          <ActionButton label="Search near me" onClick={onSearchNearMe} primary />
          <ActionButton label="Change destination" onClick={onChangeDestination} />
          <ActionButton label="Plan Trip" onClick={onPlanTrip} />
          {showContinueAnyway ? (
            <ActionButton label="Continue anyway" onClick={onContinueAnyway} subtle />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  primary = false,
  subtle = false,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  subtle?: boolean;
}) {
  if (primary) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="col-span-2 rounded-lg py-2 text-xs font-semibold text-white hover:opacity-90"
        style={{ backgroundColor: TEAL }}
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2 py-2 text-xs font-semibold hover:bg-stone-50 ${
        subtle
          ? "col-span-2 border-transparent text-stone-500 hover:text-[#0F766E]"
          : "border-stone-200 text-stone-700"
      }`}
    >
      {label}
    </button>
  );
}
