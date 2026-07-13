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
  /** Compact inline links instead of a large action grid. */
  compact?: boolean;
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
  compact = false,
}: Props) {
  const activeCopy = explanation ?? null;
  const showAiPanel = loading || Boolean(activeCopy) || Boolean(error);

  if (!template && !showAskButton && !showSafetyActions && !showAiPanel) return null;

  return (
    <div className="space-y-2.5">
      {template ? (
        <p className="rounded-lg border border-amber-200/90 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-950">
          {template.summary} {template.recommendation}
        </p>
      ) : null}

      {showAskButton && !showAiPanel ? (
        <button
          type="button"
          onClick={onAskRovi}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F766E] hover:underline"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Ask Rovi
        </button>
      ) : null}

      {showAiPanel ? (
        <div className="rounded-lg bg-stone-50 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0F766E]">
            Rovi
          </p>
          {loading ? (
            <p className="mt-1 text-xs text-stone-500">Reviewing place context…</p>
          ) : null}
          {!loading && activeCopy ? (
            <div className="mt-1 space-y-1 text-xs leading-snug text-stone-700">
              <p>{activeCopy.summary}</p>
              <p className="text-stone-600">{activeCopy.recommendation}</p>
            </div>
          ) : null}
          {!loading && !activeCopy && error ? (
            <p className="mt-1 text-xs text-stone-600">{error}</p>
          ) : null}
        </div>
      ) : null}

      {showSafetyActions ? (
        compact ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
            <button type="button" onClick={onSearchNearMe} className="text-[#0F766E] hover:underline">
              Search near me
            </button>
            <button type="button" onClick={onChangeDestination} className="text-stone-600 hover:text-stone-900">
              Change place
            </button>
            <button type="button" onClick={onPlanTrip} className="text-stone-600 hover:text-stone-900">
              Plan trip
            </button>
            {showContinueAnyway ? (
              <button type="button" onClick={onContinueAnyway} className="text-stone-500 hover:text-[#0F766E]">
                Continue anyway
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <ActionButton label="Search near me" onClick={onSearchNearMe} primary />
            <ActionButton label="Change destination" onClick={onChangeDestination} />
            <ActionButton label="Plan Trip" onClick={onPlanTrip} />
            {showContinueAnyway ? (
              <ActionButton label="Continue anyway" onClick={onContinueAnyway} subtle />
            ) : null}
          </div>
        )
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
