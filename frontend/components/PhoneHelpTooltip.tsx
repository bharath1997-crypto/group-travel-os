"use client";

import { useCallback, useEffect, useId, useState } from "react";

/**
 * Question-mark control that opens a short, friendly explainer about optional phone.
 */
export function PhoneHelpTooltip() {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onKeyDown]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-500 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        aria-label="Why add your phone number?"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
      >
        ?
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-[2px] sm:items-center"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl transition duration-200 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id={titleId}
              className="text-base font-semibold text-slate-900"
            >
              Why add your phone number?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Use it later for account recovery, trip alerts, coupon offers, and
              faster support. You can skip it for now — add it anytime in
              Settings.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
