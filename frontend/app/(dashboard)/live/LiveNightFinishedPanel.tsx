"use client";

import { Check, Clock3, MapPin } from "lucide-react";
import {
  LIVE_DOCK_PANEL,
  LIVE_DOCK_PRIMARY_CTA,
  LIVE_DOCK_SECTION_LABEL,
  LIVE_EMPTY_STATE_TITLE,
} from "./live-design-tokens";
import type { NightFinishedSummary } from "./live-night-finished";
import { formatMoney } from "./live-night-finished";

type LiveNightFinishedPanelProps = {
  summary: NightFinishedSummary;
  onOpenSplit: () => void;
  onMarkEveryoneArrived?: () => void;
  onCheckMember?: () => void;
  onReportPlace?: () => void;
};

export default function LiveNightFinishedPanel({
  summary,
  onOpenSplit,
  onMarkEveryoneArrived,
  onCheckMember,
  onReportPlace,
}: LiveNightFinishedPanelProps) {
  return (
    <div className={`overflow-hidden ${LIVE_DOCK_PANEL}`}>
      <div className="border-b border-[rgba(15,22,20,0.08)] px-3.5 py-3.5">
        <div className={`mb-2 ${LIVE_DOCK_SECTION_LABEL}`}>
          Arrived · {summary.arrivedCount} of {summary.memberCount}
        </div>
        <h2 className={`${LIVE_EMPTY_STATE_TITLE} text-[26px]`}>{summary.headline}</h2>
        <p className="mt-1 text-[11.5px] text-[#5F665F]">{summary.subline}</p>
      </div>

      <div className="flex items-center gap-3 border-b border-[rgba(15,22,20,0.08)] bg-[#F1EFE8] px-3.5 py-3.5">
        <div className="min-w-0 flex-1">
          <p className={`mb-1 ${LIVE_DOCK_SECTION_LABEL}`}>Running total</p>
          <p className="flex items-baseline gap-2">
            <span className="text-[22px] font-bold tracking-tight text-[#0F1614]">
              {formatMoney(summary.totalSpent, summary.currency)}
            </span>
            <span className="text-[12px] text-[#5F665F]">· {summary.perPersonLabel}</span>
          </p>
        </div>
        <button type="button" onClick={onOpenSplit} className={`shrink-0 ${LIVE_DOCK_PRIMARY_CTA}`}>
          Open split
        </button>
      </div>

      <div className="flex flex-col gap-2 p-3.5">
        <button
          type="button"
          onClick={onMarkEveryoneArrived}
          className="flex items-center gap-2.5 rounded-[14px] border border-[rgba(15,22,20,0.14)] bg-white px-3 py-3 text-left transition hover:border-[#0F1614]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#DCEAE5] text-[#0A4A3E]">
            <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
          </span>
          <span className="text-[13px] font-medium text-[#0F1614]">Mark everyone arrived</span>
        </button>

        <button
          type="button"
          onClick={onCheckMember}
          className="flex items-center gap-2.5 rounded-[14px] border border-[rgba(15,22,20,0.14)] bg-white px-3 py-3 text-left transition hover:border-[#0F1614]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F5EBD8] text-[#8D6A1E]">
            <Clock3 className="h-3.5 w-3.5" strokeWidth={2.2} />
          </span>
          <span className="text-[13px] font-medium text-[#0F1614]">Check on late members</span>
        </button>

        <button
          type="button"
          onClick={onReportPlace}
          className="flex items-center gap-2.5 rounded-[14px] border border-dashed border-[rgba(15,22,20,0.22)] bg-transparent px-3 py-3 text-left transition hover:border-[#0F1614]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F6F4EF] text-[#5F665F]">
            <MapPin className="h-3.5 w-3.5" strokeWidth={2.2} />
          </span>
          <span className="text-[13px] font-medium text-[#0F1614]">
            Report what it&apos;s like at {summary.destinationName}
          </span>
        </button>
      </div>
    </div>
  );
}
