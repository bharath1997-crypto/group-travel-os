"use client";

import { Check } from "lucide-react";

const STEPS = ["Flight", "Travelers", "Extras", "Review", "Payment"] as const;

type Props = {
  current: number;
};

export default function CheckoutStepper({ current }: Props) {
  return (
    <nav aria-label="Checkout progress">
      {/* Desktop Stepper */}
      <ol className="hidden grid-cols-5 md:grid">
        {STEPS.map((label, idx) => {
          const step = idx + 1;
          const active = step === current;
          const done = step < current;
          const isLast = idx === STEPS.length - 1;

          return (
            <li key={label} className="relative flex min-w-0 justify-center">
              {!isLast ? (
                <span
                  aria-hidden
                  className={`absolute left-[calc(50%+1.5rem)] right-[calc(-50%+1.5rem)] top-5 h-0.5 transition-colors duration-300 ${
                    done ? "bg-primary-soft0" : "bg-slate-200"
                  }`}
                />
              ) : null}
              <div className="relative z-10 flex min-w-20 flex-col items-center gap-2 px-2 text-center">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black transition-all duration-300 ${
                    done
                      ? "bg-primary text-white shadow-md shadow-teal-600/20"
                      : active
                      ? "bg-primary text-white shadow-lg shadow-teal-600/25 ring-4 ring-primary/20"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={3} /> : step}
                </span>
                <span
                  className={`whitespace-nowrap text-xs font-bold transition-colors ${
                    active ? "text-primary" : done ? "text-slate-600" : "text-slate-400"
                  }`}
                >
                  {label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Mobile Compact Stepper */}
      <div className="flex min-h-10 items-center justify-between gap-4 md:hidden">
        <div className="flex flex-1 items-center gap-1.5">
          {STEPS.map((_, idx) => {
            const step = idx + 1;
            const done = step < current;
            const active = step === current;
            return (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all duration-300 ${
                  done
                    ? "flex-1 bg-primary-soft0"
                    : active
                    ? "flex-[1.35] bg-primary"
                    : "flex-1 bg-slate-200"
                }`}
              />
            );
          })}
        </div>
        <p className="shrink-0 text-xs font-bold text-slate-700 sm:text-sm">
          Step {current}/{STEPS.length} — <span className="text-primary">{STEPS[current - 1]}</span>
        </p>
      </div>
    </nav>
  );
}

export { STEPS };
