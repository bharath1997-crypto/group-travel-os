"use client";

import { useState } from "react";
import { X, ChevronDown, ChevronUp, Plane, Car, Train, Bus, ArrowRight } from "lucide-react";
import { LIVE_PANEL_RIGHT_INSET } from "./live-layout";
import type {
  RouteIntelligenceResponse,
  RouteOption,
  RouteSegment,
} from "./route-intelligence-types";
import {
  routeSegmentIcon,
  routeOptionIcon,
  providerStatusLabel,
  providerStatusColor,
} from "./route-intelligence-types";

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  originName: string;
  destinationName: string;
  loading: boolean;
  error: string | null;
  response: RouteIntelligenceResponse | null;
  onSelectOption?: (option: RouteOption) => void;
  onClose: () => void;
  onPlanTrip: () => void;
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function SegmentRow({ segment }: { segment: RouteSegment }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-base shrink-0 mt-0.5">{routeSegmentIcon(segment.type)}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-stone-800 leading-snug">{segment.title}</p>
        {segment.estimatedDuration && (
          <p className="text-[10px] text-stone-500 mt-0.5">{segment.estimatedDuration}</p>
        )}
        {segment.notes && segment.notes.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {segment.notes.map((n, i) => (
              <p key={i} className="text-[10px] text-amber-700 leading-snug">{n}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RouteOptionCard({
  option,
  onSelect,
}: {
  option: RouteOption;
  onSelect?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 ${
        option.recommended
          ? "border-teal-200 bg-teal-50/60 shadow-sm ring-1 ring-teal-300/40"
          : "border-stone-200/80 bg-white/70"
      }`}
    >
      {/* Card Header */}
      <button
        type="button"
        className="w-full text-left p-4 flex items-start gap-3"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
      >
        <span className="text-xl shrink-0 mt-0.5">{routeOptionIcon(option.type)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-stone-900">{option.title}</span>
            {option.recommended && (
              <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white">
                Recommended
              </span>
            )}
          </div>
          {option.bestFor && (
            <p className="mt-0.5 text-[11px] text-stone-500">
              Best for: <span className="font-medium text-stone-700">{option.bestFor}</span>
            </p>
          )}
          {/* Segment mini-summary (collapsed) */}
          {!expanded && (
            <div className="mt-2 flex items-center gap-1 flex-wrap">
              {option.segments.slice(0, 4).map((seg, i) => (
                <span key={seg.id} className="flex items-center gap-1">
                  {i > 0 && <ArrowRight className="h-2.5 w-2.5 text-stone-400 shrink-0" />}
                  <span className="text-[10px] font-medium text-stone-600 leading-snug">
                    {routeSegmentIcon(seg.type)} {seg.fromName.split("(")[0].trim()}
                  </span>
                </span>
              ))}
              {option.segments.length > 4 && (
                <span className="text-[10px] text-stone-400">+{option.segments.length - 4} more</span>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-stone-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-stone-400" />
          )}
        </div>
      </button>

      {/* Expanded Segments */}
      {expanded && (
        <div className="px-4 pb-4">
          <div className="border-t border-stone-100 pt-3 space-y-0.5">
            {option.segments.map((seg) => (
              <SegmentRow key={seg.id} segment={seg} />
            ))}
          </div>

          {/* Provider status */}
          <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${providerStatusColor(option.providerStatus)}`}
            >
              {providerStatusLabel(option.providerStatus)}
            </span>
            {option.estimatedDuration && (
              <span className="text-[11px] text-stone-500">
                Est. {option.estimatedDuration}
              </span>
            )}
          </div>

          {option.notes && option.notes.length > 0 && (
            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 p-3 space-y-1">
              {option.notes.map((n, i) => (
                <p key={i} className="text-[11px] text-amber-800 leading-snug">{n}</p>
              ))}
            </div>
          )}

          {onSelect && (
            <button
              type="button"
              onClick={onSelect}
              className="mt-4 w-full rounded-xl bg-[#0F766E] py-2.5 text-center text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
            >
              Select this route
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Rovi Explanation Block ─────────────────────────────────────────────────────

function RoviExplanationBlock({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  return (
    <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/80 to-white/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0F766E]">
          <span className="text-xs font-bold text-white">R</span>
        </div>
        <span className="text-xs font-semibold text-teal-800">Rovi Route Intelligence</span>
      </div>
      <div className="space-y-2">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-sm text-stone-700 leading-relaxed">{p}</p>
        ))}
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-full bg-teal-200" />
          <div className="h-3 w-40 rounded bg-teal-200" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-stone-200" />
          <div className="h-3 w-3/4 rounded bg-stone-200" />
          <div className="h-3 w-5/6 rounded bg-stone-200" />
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-stone-200 bg-white/50 p-4">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-full bg-stone-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded bg-stone-200" />
              <div className="h-2 w-1/2 rounded bg-stone-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function RoviRouteIntelligencePanel({
  originName,
  destinationName,
  loading,
  error,
  response,
  onSelectOption,
  onClose,
  onPlanTrip,
}: Props) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  function handleSelect(option: RouteOption) {
    setSelectedOptionId(option.id);
    onSelectOption?.(option);
  }

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-30 flex max-h-[80vh] flex-col overflow-hidden rounded-t-2xl border border-teal-200/60 bg-white/95 shadow-[0_-8px_40px_rgba(0,0,0,0.14)] backdrop-blur-md max-lg:fixed lg:inset-x-auto lg:bottom-auto ${LIVE_PANEL_RIGHT_INSET} lg:top-[72px] lg:w-[min(440px,calc(100%-6.5rem))] lg:max-h-[calc(100%-6.5rem)] lg:rounded-2xl lg:shadow-[0_8px_30px_rgba(0,0,0,0.12)]`}
      role="dialog"
      aria-label="Rovi Route Intelligence"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-stone-900 leading-tight">
            Route options
          </h3>
          <p className="mt-0.5 text-xs text-stone-500 truncate">
            {originName} → {destinationName}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Loading */}
        {loading && <LoadingSkeleton />}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <p className="mt-1 text-xs text-red-500">
              Route intelligence is temporarily unavailable. Try planning from the Trips page.
            </p>
          </div>
        )}

        {/* Resolved response */}
        {!loading && !error && response && (
          <>
            {/* Distance / type badge row */}
            <div className="flex items-center gap-2 flex-wrap">
              {response.distance_km != null && (
                <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">
                  ~{Math.round(response.distance_km).toLocaleString()} km
                </span>
              )}
              {response.is_international && (
                <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
                  International
                </span>
              )}
              {response.requires_border_crossing && (
                <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                  Border crossing
                </span>
              )}
            </div>

            {/* Rovi AI explanation */}
            {response.rovi_explanation && (
              <RoviExplanationBlock text={response.rovi_explanation} />
            )}

            {/* Route option cards */}
            <div className="space-y-3">
              {response.route_options.map((option) => (
                <RouteOptionCard
                  key={option.id}
                  option={option}
                  onSelect={() => handleSelect(option)}
                />
              ))}
            </div>

            {response.route_options.length === 0 && (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-center">
                <p className="text-sm text-stone-600">No route options could be resolved for this destination.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-stone-100 px-5 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onPlanTrip}
          className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
        >
          Plan this trip
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl bg-[#0F766E] py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
        >
          Back to map
        </button>
      </div>
    </div>
  );
}
