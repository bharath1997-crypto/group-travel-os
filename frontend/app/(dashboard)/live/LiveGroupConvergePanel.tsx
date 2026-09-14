"use client";

import { useState } from "react";
import {
  LIVE_DOCK_PANEL,
  LIVE_DOCK_SECTION_LABEL,
  LIVE_EMPTY_STATE_TITLE,
} from "./live-design-tokens";
import type { GroupConvergeMember, GroupWayraNotice } from "./live-group-converge-mock";
import { formatLastOneInTime, lastOneInMinutes } from "./live-group-converge-mock";

type LiveGroupConvergePanelProps = {
  destinationName: string;
  members: GroupConvergeMember[];
  arrivalBanner?: {
    arrivedCount: number;
    memberCount: number;
    subline: string;
    suggestSettle: boolean;
  } | null;
  tableHoldNote?: string;
  wayraNotice?: GroupWayraNotice | null;
  onMemberAction?: (memberId: string) => void;
  onStatusAction?: (action: "on_my_way" | "running_late" | "navigate" | "night_finished") => void;
  onWayraAction?: (actionId: string) => void;
};

function etaClassName(status: GroupConvergeMember["status"]): string {
  if (status === "late") return "text-[#8D6A1E]";
  if (status === "stale") return "text-[#5F665F]";
  return "text-primary";
}

export default function LiveGroupConvergePanel({
  destinationName,
  members,
  arrivalBanner,
  tableHoldNote = "Table held till 7:15 — Rovvy pushed it to 7:30",
  wayraNotice,
  onMemberAction,
  onStatusAction,
  onWayraAction,
}: LiveGroupConvergePanelProps) {
  const [wayraOpen, setWayraOpen] = useState(true);
  const lastIn = formatLastOneInTime(lastOneInMinutes(members));

  return (
    <div className="flex flex-col gap-2.5">
      <div className={`overflow-hidden ${LIVE_DOCK_PANEL}`}>
        <div className="border-b border-[rgba(15,22,20,0.08)] px-3.5 py-3.5">
          <div className={`mb-2 flex items-center gap-1.5 ${LIVE_DOCK_SECTION_LABEL}`}>
            <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-primary" aria-hidden />
            Converging · {destinationName}
          </div>
          <h2 className={`${LIVE_EMPTY_STATE_TITLE} text-2xl`}>
            Last one in at <em className="not-italic">{lastIn}</em>
          </h2>
          <p className="mt-1 text-[11.5px] text-[#5F665F]">{tableHoldNote}</p>
          {arrivalBanner && arrivalBanner.arrivedCount >= 2 ? (
            <div className="mt-2.5 rounded-xl border border-[rgba(15,118,110,0.18)] bg-[rgba(15,118,110,0.06)] px-3 py-2.5">
              <p className="text-[12px] font-semibold text-[#0F766E]">
                {arrivalBanner.arrivedCount} of {arrivalBanner.memberCount} at the meetup
              </p>
              <p className="mt-0.5 text-[11px] text-[#5F665F]">{arrivalBanner.subline}</p>
              {arrivalBanner.suggestSettle ? (
                <button
                  type="button"
                  onClick={() => onStatusAction?.("night_finished")}
                  className="mt-2 rounded-full bg-[#0F766E] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#0D655E]"
                >
                  Wrap night & settle
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div>
          {members.map((member, index) => (
            <button
              key={member.id}
              type="button"
              onClick={() => onMemberAction?.(member.id)}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-white ${
                index > 0 ? "border-t border-[rgba(15,22,20,0.06)]" : ""
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold ${member.avatarClassName} ${member.ringClassName}`}
              >
                {member.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-[12.5px] font-semibold ${
                    member.status === "stale" ? "text-[#5A615A]" : "text-[#0F1614]"
                  }`}
                >
                  {member.name}
                </span>
                <span className="mt-0.5 block font-mono text-[9.5px] text-[#5F665F]">
                  {member.detail}
                </span>
              </span>
              <span
                className={`shrink-0 font-mono text-[13px] font-medium ${etaClassName(member.status)}`}
              >
                {member.etaLabel}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-[rgba(15,22,20,0.08)] bg-[#F1EFE8] px-3.5 py-3">
          {(
            [
              ["on_my_way", "On my way"],
              ["running_late", "Running late"],
              ["navigate", "Navigate"],
              ["night_finished", "Night finished"],
            ] as const
          ).map(([action, label]) => (
            <button
              key={action}
              type="button"
              onClick={() => onStatusAction?.(action)}
              className="min-w-[92px] flex-1 rounded-full border border-[rgba(15,22,20,0.16)] bg-white px-2 py-2.5 text-[11.5px] font-semibold text-[#0F1614] transition hover:border-[#0F1614]"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {wayraNotice && wayraOpen ? (
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#141033] to-[#0B1512] p-3.5 text-[#F6F4EF] shadow-[0_12px_30px_-14px_rgba(0,0,0,0.55)]">
          <div className="mb-2 flex items-start justify-between gap-2">
            <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-[#C9BFFF]">
              ✦ Wayra noticed
            </span>
            <button
              type="button"
              onClick={() => setWayraOpen(false)}
              aria-label="Dismiss"
              className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-xs text-[#F6F4EF] hover:border-white/50"
            >
              ×
            </button>
          </div>
          <p className="font-serif text-[17px] leading-snug">{wayraNotice.headline}</p>
          <div className="mt-2.5 flex flex-col gap-1.5">
            {wayraNotice.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onWayraAction?.(action.id)}
                className="rounded-[10px] border border-white/20 bg-white/5 px-3 py-2.5 text-left text-[11.5px] font-medium text-[#F6F4EF] transition hover:border-white/50"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
