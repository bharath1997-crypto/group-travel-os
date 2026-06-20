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
};

export function NavigationSheet({
  destinationName,
  route,
  activeStepIndex,
  navigationActive,
  onStart,
  onCancel,
  onEnd,
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
        <button
          type="button"
          onClick={onStart}
          className="mt-4 w-full rounded-xl bg-[#0F766E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0d655c]"
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
