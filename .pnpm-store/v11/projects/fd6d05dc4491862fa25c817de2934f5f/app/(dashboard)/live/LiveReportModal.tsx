"use client";

import { useState } from "react";
import { LIVE_DOCK_PANEL, LIVE_DOCK_SECTION_LABEL, LIVE_EMPTY_STATE_TITLE } from "./live-design-tokens";
import {
  LIVE_PLACE_REPORT_DISCLAIMER,
  LIVE_PLACE_REPORT_OPTIONS,
  type LivePlaceReportType,
} from "./live-place-report-types";
import { submitLivePlaceReport } from "./live-place-reports";

type LiveReportModalProps = {
  open: boolean;
  onClose: () => void;
  placeName: string;
  lat: number;
  lng: number;
  placeKey?: string | null;
  onAuthRequired: () => void;
  onSubmitted?: (result: { reportType: LivePlaceReportType; confirmed: boolean }) => void;
};

export default function LiveReportModal({
  open,
  onClose,
  placeName,
  lat,
  lng,
  placeKey,
  onAuthRequired,
  onSubmitted,
}: LiveReportModalProps) {
  const [submitting, setSubmitting] = useState<LivePlaceReportType | null>(null);

  if (!open) return null;

  async function handleSelect(reportType: LivePlaceReportType) {
    if (submitting) return;
    setSubmitting(reportType);
    try {
      const result = await submitLivePlaceReport({
        lat,
        lng,
        reportType,
        placeName,
        placeKey,
      });
      if (!result.ok) {
        if (result.reason === "auth_required") {
          onAuthRequired();
          return;
        }
        return;
      }
      onSubmitted?.({ reportType, confirmed: result.confirmed });
      onClose();
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[rgba(7,17,14,0.5)] p-0 backdrop-blur-[3px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`mb-14 w-[min(520px,calc(100vw-2rem))] px-4 ${LIVE_DOCK_PANEL}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-report-modal-title"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <div className={LIVE_DOCK_SECTION_LABEL}>Report · {placeName}</div>
            <h2 id="live-report-modal-title" className={`mt-1.5 ${LIVE_EMPTY_STATE_TITLE} text-2xl`}>
              What&apos;s it like there?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(15,22,20,0.14)] bg-white text-[#2A312B] transition hover:border-[#0F1614]"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 px-5 py-4">
          {LIVE_PLACE_REPORT_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isBusy = submitting === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={Boolean(submitting)}
                onClick={() => void handleSelect(option.id)}
                className="flex flex-col gap-1.5 rounded-2xl border border-[rgba(15,22,20,0.13)] bg-white px-3.5 py-3.5 text-left transition hover:border-[#0F1614] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon className={`h-[17px] w-[17px] ${option.iconClassName}`} aria-hidden />
                <span className="text-[12.5px] font-semibold text-[#0F1614]">
                  {isBusy ? "Sending…" : option.label}
                </span>
                <span className="font-mono text-[10px] text-[#5F665F]">{option.hint}</span>
              </button>
            );
          })}
        </div>

        <p className="px-5 pb-5 text-[11.5px] leading-relaxed text-[#5F665F]">
          {LIVE_PLACE_REPORT_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}
