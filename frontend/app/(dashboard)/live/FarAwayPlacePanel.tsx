"use client";

import { AlertTriangle, X } from "lucide-react";
import type { PlacePreviewData } from "./PlacePreviewCard";
import { LiveDataTrustBadge, LiveDataTrustFooter } from "./LiveDataTrustBadge";
import RoviPlaceExplanationBlock from "./RoviPlaceExplanationBlock";
import { LIVE_PANEL_RIGHT_INSET } from "./live-layout";
import type { LiveLocationContext } from "./live-location-context";
import type { RoviPlaceExplanation } from "./live-rovi";
import { formatDistanceMiles } from "./live-types";

type Props = {
  place: PlacePreviewData;
  locationContext: LiveLocationContext;
  showAskRovi: boolean;
  roviLoading: boolean;
  roviExplanation: RoviPlaceExplanation | null;
  roviError: string | null;
  onAskRovi: () => void;
  onSearchNearMe: () => void;
  onChangeDestination: () => void;
  onPlanTrip: () => void;
  onContinueAnyway: () => void;
  onClose: () => void;
};

export default function FarAwayPlacePanel({
  place,
  locationContext,
  showAskRovi,
  roviLoading,
  roviExplanation,
  roviError,
  onAskRovi,
  onSearchNearMe,
  onChangeDestination,
  onPlanTrip,
  onContinueAnyway,
  onClose,
}: Props) {
  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-30 flex max-h-[72vh] flex-col overflow-hidden rounded-t-2xl border border-amber-200/80 bg-white/95 shadow-[0_-8px_40px_rgba(0,0,0,0.12)] backdrop-blur-md max-lg:fixed lg:inset-x-auto lg:bottom-auto ${LIVE_PANEL_RIGHT_INSET} lg:top-[72px] lg:w-[min(420px,calc(100%-6.5rem))] lg:max-h-[calc(100%-6.5rem)] lg:rounded-2xl lg:shadow-[0_8px_30px_rgba(0,0,0,0.12)]`}
      role="dialog"
      aria-label="Far-away place warning"
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-700" />
            </div>
            <div className="min-w-0">
              <LiveDataTrustBadge variant="area" className="mb-1.5" />
              <h3 className="text-lg font-bold leading-tight text-stone-900">
                {locationContext.template.summary}
              </h3>
              <p className="mt-1 text-sm text-stone-600">
                {locationContext.template.recommendation}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-stone-100 bg-stone-50/80 p-4">
          <LiveDataTrustBadge variant="verified" className="mb-2" />
          <p className="text-base font-semibold text-stone-900">{place.name}</p>
          <p className="mt-1 text-sm text-stone-600">{place.address}</p>
          {place.distanceM != null ? (
            <p className="mt-2 text-sm font-medium text-amber-800">
              {formatDistanceMiles(place.distanceM)} from your location
            </p>
          ) : null}
        </div>

        <div className="mt-4 space-y-2">
          <LiveDataTrustBadge variant="ai" />
          <RoviPlaceExplanationBlock
            showAskButton={showAskRovi}
            showSafetyActions={!locationContext.liveSafe}
            template={null}
            loading={roviLoading}
            explanation={roviExplanation}
            error={roviError}
            onAskRovi={onAskRovi}
            onSearchNearMe={onSearchNearMe}
            onChangeDestination={onChangeDestination}
            onPlanTrip={onPlanTrip}
            onContinueAnyway={onContinueAnyway}
          />
        </div>

        <LiveDataTrustFooter showWayraNote className="mt-4" />
      </div>
    </div>
  );
}
