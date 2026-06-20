"use client";

import { Loader2, MapPin, Users, X } from "lucide-react";
import {
  etaMinutesToPoint,
  firstName,
  isMemberOffline,
  memberColorForIndex,
  memberStatusValue,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  type ConvoyData,
  type MeetingPoint,
  type MemberLiveData,
  type QuickStatus,
  type TripMember,
} from "@/lib/live/group";

type GroupPanelProps = {
  open: boolean;
  tripName: string;
  members: TripMember[];
  memberLive: Record<string, MemberLiveData>;
  memberStatuses: Record<string, QuickStatus>;
  meetingPoint: MeetingPoint | null;
  convoy: ConvoyData | null;
  isGroupAdmin: boolean;
  currentUserId: string | null;
  currentUserSpeedMph: number;
  statusBusy: boolean;
  onClose: () => void;
  onSetMeetingPoint: () => void;
  onClearMeetingPoint: () => void;
  onStartConvoy: () => void;
  onEndConvoy: () => void;
  onQuickStatus: (status: QuickStatus) => void;
};

const QUICK_BUTTONS: { status: QuickStatus; emoji: string; label: string; className: string }[] =
  [
    { status: "on_my_way", emoji: "🚗", label: "On my way", className: "bg-teal-600" },
    { status: "wait_for_me", emoji: "⏳", label: "Wait for me", className: "bg-amber-500" },
    { status: "at_the_spot", emoji: "📍", label: "At the spot", className: "bg-green-600" },
    { status: "need_help", emoji: "🆘", label: "Need help", className: "bg-red-600" },
  ];

export function GroupPanel({
  open,
  tripName,
  members,
  memberLive,
  memberStatuses,
  meetingPoint,
  convoy,
  isGroupAdmin,
  currentUserId,
  currentUserSpeedMph,
  statusBusy,
  onClose,
  onSetMeetingPoint,
  onClearMeetingPoint,
  onStartConvoy,
  onEndConvoy,
  onQuickStatus,
}: GroupPanelProps) {
  return (
    <div
      className={`pointer-events-auto absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[280px] transition-transform duration-300 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-l-2xl bg-white/95 shadow-2xl ring-1 ring-stone-200/80 backdrop-blur-sm">
        <div className="border-b border-stone-200 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-stone-900">{tripName}</h2>
              <p className="mt-0.5 text-xs text-stone-500">
                {members.length} members · group mode
              </p>
            </div>
            <button
              type="button"
              aria-label="Close group panel"
              onClick={onClose}
              className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Members
            </h3>
            <ul className="space-y-2">
              {members.map((member, index) => {
                const live = memberLive[member.user_id];
                const status =
                  memberStatuses[member.user_id] ??
                  memberStatusValue(live) ??
                  "on_my_way";
                const offline = isMemberOffline(live?.last_seen);
                const eta =
                  meetingPoint && live?.lat != null && live?.lng != null
                    ? etaMinutesToPoint(
                        live.lat,
                        live.lng,
                        meetingPoint.lat,
                        meetingPoint.lng,
                        member.user_id === currentUserId ? currentUserSpeedMph : undefined,
                      )
                    : null;

                return (
                  <li
                    key={member.user_id}
                    className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border-2 border-white shadow"
                      style={{ backgroundColor: memberColorForIndex(index) }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-stone-900">
                          {firstName(member.display_name)}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE_CLASSES[status]}`}
                        >
                          {STATUS_LABELS[status]}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-stone-500">
                        {offline ? (
                          <span className="text-amber-600">Offline</span>
                        ) : meetingPoint && eta != null ? (
                          <span>~{eta} min to meet</span>
                        ) : null}
                        {member.is_admin ? (
                          <span className="text-teal-700">Admin</span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {isGroupAdmin ? (
            <section className="mt-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Admin controls
              </h3>
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={onSetMeetingPoint}
                  className="flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
                >
                  <MapPin size={16} />
                  Set meeting point
                </button>
                {meetingPoint ? (
                  <button
                    type="button"
                    onClick={onClearMeetingPoint}
                    className="rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                  >
                    Clear meeting point
                  </button>
                ) : null}
                {!convoy?.active ? (
                  <button
                    type="button"
                    onClick={onStartConvoy}
                    className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100"
                  >
                    Start convoy
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onEndConvoy}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                  >
                    End convoy
                  </button>
                )}
              </div>
            </section>
          ) : null}

          <section className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Quick status
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_BUTTONS.map((btn) => (
                <button
                  key={btn.status}
                  type="button"
                  disabled={statusBusy}
                  onClick={() => onQuickStatus(btn.status)}
                  className={`flex flex-col items-center justify-center rounded-xl px-2 py-3 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60 ${btn.className}`}
                >
                  <span className="text-lg">{btn.emoji}</span>
                  <span className="mt-1">{btn.label}</span>
                </button>
              ))}
            </div>
            {statusBusy ? (
              <div className="mt-2 flex items-center justify-center gap-2 text-xs text-stone-500">
                <Loader2 size={14} className="animate-spin" />
                Updating…
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

export function GroupPanelToggle({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Toggle group panel"
      className={`pointer-events-auto absolute right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.75rem)] z-20 flex h-10 w-10 items-center justify-center rounded-full shadow-lg backdrop-blur-sm transition ${
        active
          ? "bg-teal-600 text-white"
          : "bg-[rgba(15,23,42,0.82)] text-white hover:bg-[rgba(15,23,42,0.92)]"
      }`}
    >
      <Users size={18} />
    </button>
  );
}
