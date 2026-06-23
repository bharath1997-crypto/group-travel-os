"use client";

import { Loader2, X } from "lucide-react";
import {
  REPORT_CONFIG,
  REPORT_TYPES,
  type ReportType,
} from "@/lib/live/types";

type ReportTypeSheetProps = {
  onClose: () => void;
  onSelect: (type: ReportType) => void;
  submitting?: boolean;
};

export function ReportTypeSheet({
  onClose,
  onSelect,
  submitting = false,
}: ReportTypeSheetProps) {
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40">
      <button
        type="button"
        aria-label="Close report types"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900">
            Report a road hazard
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {REPORT_TYPES.map((type) => {
            const config = REPORT_CONFIG[type];
            return (
              <button
                key={type}
                type="button"
                disabled={submitting}
                onClick={() => onSelect(type)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-4 text-center transition hover:border-[#0F766E] hover:bg-[#F0FDF9] disabled:opacity-60"
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-white"
                  style={{ backgroundColor: config.color }}
                  aria-hidden
                >
                  {config.emoji}
                </span>
                <span className="text-xs font-semibold text-stone-700">
                  {config.label}
                </span>
              </button>
            );
          })}
        </div>

        {submitting ? (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-stone-500">
            <Loader2 size={16} className="animate-spin text-[#0F766E]" />
            Submitting report…
          </div>
        ) : null}
      </div>
    </div>
  );
}
