"use client";

import {
  formatETA,
  formatInstruction,
  formatNavDistance,
  type RouteData,
  type RouteStep,
} from "@/lib/live/navigation";

type NavigationSheetProps = {
  destinationName: string;
  route: RouteData;
  activeStepIndex: number;
  navigationActive: boolean;
  onStart: () => void;
  onCancel: () => void;
  onEnd: () => void;
  
  transportMode?: "driving" | "bike" | "foot";
  onTransportModeChange?: (mode: "driving" | "bike" | "foot") => void;
  availableRoutes?: RouteData[];
  selectedRouteIndex?: number;
  onSelectRouteIndex?: (index: number) => void;
  routeTolls?: number[];
};

export function NavigationSheet({
  destinationName,
  route,
  activeStepIndex,
  navigationActive,
  onStart,
  onCancel,
  onEnd,
  
  transportMode = "driving",
  onTransportModeChange,
  availableRoutes,
  selectedRouteIndex = 0,
  onSelectRouteIndex,
  routeTolls,
}: NavigationSheetProps) {
  const currentStep: RouteStep | undefined = route.steps[activeStepIndex];
  const nextStep: RouteStep | undefined = route.steps[activeStepIndex + 1];
  const progress =
    route.steps.length > 0
      ? Math.min(100, Math.round((activeStepIndex / route.steps.length) * 100))
      : 0;

  if (navigationActive) {
    return (
      <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-[115] flex max-w-lg mx-auto flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-stone-200" />
        <div className="flex h-[50dvh] flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0F766E]">
              Navigation active
            </p>
            <p className="mt-1 text-lg font-semibold leading-snug text-stone-900">
              {currentStep ? formatInstruction(currentStep) : "Continue to destination"}
            </p>
            {currentStep ? (
              <p className="mt-1 text-sm text-stone-500">
                In {formatNavDistance(currentStep.distance)}
              </p>
            ) : null}
          </div>

          {nextStep ? (
            <div className="mb-4 rounded-xl bg-stone-50 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                Then
              </p>
              <p className="text-sm text-stone-600">{formatInstruction(nextStep)}</p>
            </div>
          ) : null}

          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
              <span>
                Step {Math.min(activeStepIndex + 1, route.steps.length)} of{" "}
                {route.steps.length}
              </span>
              <span>ETA {formatETA(route.total_duration_s)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-[#0F766E] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-auto">
            <button
              type="button"
              onClick={onEnd}
              className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              End Navigation
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-[115] flex max-w-lg mx-auto flex-col rounded-t-3xl bg-white shadow-2xl">
      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        {/* Transport Selector tabs */}
        <div className="flex gap-2 border-b border-stone-100 pb-3 mb-3">
          {(["driving", "bike", "foot"] as const).map((m) => {
            const label = m === "driving" ? "🚗 Drive" : m === "bike" ? "🚲 Bike" : "🚶 Walk";
            const active = transportMode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onTransportModeChange?.(m)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active ? "bg-[#0F766E] text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Route ready
        </p>
        <p className="mt-1 truncate text-lg font-semibold text-stone-900">
          {destinationName}
        </p>
        <p className="mt-1 text-sm text-stone-600">
          {formatNavDistance(route.total_distance_m)} · ETA{" "}
          {formatETA(route.total_duration_s)}
        </p>

        {/* Alternative Routes Selection List */}
        {availableRoutes && availableRoutes.length > 1 && (
          <div className="flex flex-col gap-2 my-3 max-h-40 overflow-y-auto pr-1">
            {availableRoutes.map((r, index) => {
              const durationMin = Math.round(r.total_duration_s / 60);
              const distMiles = (r.total_distance_m * 0.000621371).toFixed(1);
              const tolls = routeTolls?.[index] ?? 0;
              const isSelected = selectedRouteIndex === index;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => onSelectRouteIndex?.(index)}
                  className={`flex items-center justify-between rounded-xl p-3 text-left transition border text-xs font-semibold ${
                    isSelected
                      ? "bg-teal-50/50 border-[#0F766E] text-[#0F766E]"
                      : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  <div>
                    <div className="font-bold text-sm">
                      Route {index + 1} ({durationMin} min)
                    </div>
                    <div className="text-stone-500 text-[10px] font-medium mt-0.5">
                      {distMiles} miles {tolls > 0 ? `· ${tolls} tolls` : ""}
                    </div>
                  </div>
                  {isSelected && <span className="text-sm">✓</span>}
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={onStart}
          className="mt-2 w-full rounded-xl bg-[#0F766E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0d655c]"
        >
          Start Navigation
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
