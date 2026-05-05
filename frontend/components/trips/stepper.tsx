"use client";

import { Check } from "lucide-react";

const CORAL = "#E94560";

export function Stepper({
  steps,
  currentStep,
  onStepClick,
}: {
  steps: string[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}) {
  return (
    <div className="mt-6 flex items-start justify-between gap-1 overflow-x-auto pb-2">
      {steps.map((lab, i) => {
        const n = i + 1;
        const done = currentStep > n;
        const active = currentStep === n;
        return (
          <div
            key={lab}
            className="flex min-w-[52px] flex-1 flex-col items-center"
          >
            <div className="flex w-full items-center">
              {i > 0 ? (
                <div
                  className="h-px flex-1"
                  style={{
                    background: done || active ? CORAL : "#DEE2E6",
                  }}
                />
              ) : null}
              <button
                type="button"
                disabled={!onStepClick}
                onClick={() => onStepClick?.(n)}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition ${
                  done
                    ? "border-[#E94560] bg-[#E94560] text-white"
                    : active
                      ? "border-[#E94560] bg-white text-[#E94560]"
                      : "border-gray-300 bg-white text-gray-400"
                }`}
                style={
                  active && !done
                    ? { borderColor: CORAL, color: CORAL }
                    : undefined
                }
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                ) : (
                  n
                )}
              </button>
              {i < steps.length - 1 ? (
                <div
                  className="h-px flex-1"
                  style={{
                    background: currentStep > n ? CORAL : "#DEE2E6",
                  }}
                />
              ) : null}
            </div>
            <span className="mt-1 max-w-[72px] text-center text-[10px] text-[#6C757D]">
              {lab}
            </span>
          </div>
        );
      })}
    </div>
  );
}
