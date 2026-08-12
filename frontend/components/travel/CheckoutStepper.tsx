"use client";

import { Check } from "lucide-react";

const STEPS = ["Flight", "Travelers", "Extras", "Review", "Payment"] as const;

type Props = {
  current: number;
};

export default function CheckoutStepper({ current }: Props) {
  return (
    <nav aria-label="Checkout progress" className="mb-8">
      {/* Desktop Stepper */}
      <ol className="hidden items-center md:flex">
        {STEPS.map((label, idx) => {
          const step = idx + 1;
          const active = step === current;
          const done = step < current;
          const isLast = idx === STEPS.length - 1;

          return (
            <li key={label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black transition-all duration-300 ${
                    done
                      ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                      : active
                      ? "bg-teal-600 text-white shadow-lg shadow-teal-600/25 ring-4 ring-teal-200"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={3} /> : step}
                </span>
                <span
                  className={`whitespace-nowrap text-xs font-bold transition-colors ${
                    active ? "text-teal-700" : done ? "text-slate-600" : "text-slate-400"
                  }`}
                >
                  {label}
                </span>
              </div>
              {!isLast ? (
                <div
                  className={`mx-2 mb-5 h-0.5 flex-1 transition-colors duration-300 ${
                    done ? "bg-teal-500" : "bg-slate-200"
                  }`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Mobile Compact Stepper */}
      <div className="flex items-center gap-3 md:hidden">
        <div className="flex items-center gap-1">
          {STEPS.map((_, idx) => {
            const step = idx + 1;
            const done = step < current;
            const active = step === current;
            return (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all duration-300 ${
                  done
                    ? "w-6 bg-teal-500"
                    : active
                    ? "w-8 bg-teal-600"
                    : "w-2 bg-slate-200"
                }`}
              />
            );
          })}
        </div>
        <p className="text-sm font-bold text-slate-700">
          Step {current}/{STEPS.length} — <span className="text-teal-700">{STEPS[current - 1]}</span>
        </p>
      </div>
    </nav>
  );
}

export { STEPS };
