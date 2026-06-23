"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp, X } from "lucide-react";
import { RouteChatSheet } from "@/components/live/RouteChatSheet";
import {
  REPORT_CONFIG,
  minutesAgo,
  type RoadReport,
} from "@/lib/live/types";

type ReportSheetProps = {
  report: RoadReport;
  isGuest: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onDismiss: () => void;
  onGuestAction: (message: string) => void;
  onToast?: (message: string) => void;
  busy?: boolean;
};

export function ReportSheet({
  report,
  isGuest,
  onClose,
  onConfirm,
  onDismiss,
  onGuestAction,
  onToast,
  busy = false,
}: ReportSheetProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const config = REPORT_CONFIG[report.report_type];
  const areaLabel = report.city?.trim() || "this area";
  const ago = minutesAgo(report.created_at);

  const handleConfirm = () => {
    if (isGuest) {
      onGuestAction("Sign in to confirm road reports");
      return;
    }
    onConfirm();
  };

  const handleDismiss = () => {
    if (isGuest) {
      onGuestAction("Sign in to dismiss road reports");
      return;
    }
    onDismiss();
  };

  const handleChat = () => {
    if (isGuest) {
      onGuestAction("Sign in to chat with travelers on this route");
      return;
    }
    setChatOpen(true);
  };

  return (
    <>
      <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40">
        <button
          type="button"
          aria-label="Close report details"
          className="absolute inset-0"
          onClick={onClose}
        />
        <div className="relative z-10 w-full max-w-lg rounded-t-3xl bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200" />
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full text-lg"
                style={{ backgroundColor: config.color }}
                aria-hidden
              >
                {config.emoji}
              </span>
              <div>
                <h2 className="text-base font-semibold text-stone-900">
                  {config.label}
                </h2>
                <p className="text-sm text-stone-500">
                  Reported {ago === 0 ? "just now" : `${ago} min ago`}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <X size={18} />
            </button>
          </div>

          <p className="mb-4 text-sm text-stone-600">Traveler on {areaLabel}</p>

          <p className="mb-5 text-sm font-medium text-stone-700">
            👍 {report.confirmed_count} confirmed
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleConfirm}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-3 py-3 text-sm font-semibold text-white transition hover:bg-[#0d655c] disabled:opacity-60"
            >
              <ThumbsUp size={16} />
              Still there
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleDismiss}
              className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 px-3 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-60"
            >
              <ThumbsDown size={16} />
              No longer there
            </button>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleChat}
            className="mt-3 w-full rounded-xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-60"
          >
            Chat with reporter
          </button>
        </div>
      </div>

      {chatOpen ? (
        <RouteChatSheet
          report={report}
          onClose={() => setChatOpen(false)}
          onToast={onToast}
        />
      ) : null}
    </>
  );
}
