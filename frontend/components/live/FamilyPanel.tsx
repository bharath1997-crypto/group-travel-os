"use client";

import {
  BatteryLow,
  MapPin,
  Users,
  X,
} from "lucide-react";
import {
  etaMinutesToPoint,
  memberColorForIndex,
  type ConvoyData,
  type MeetingPoint,
  type MemberLiveData,
  type QuickStatus,
  type TripMember,
} from "@/lib/live/group";

const STATUS_CONFIG: Record<
  QuickStatus,
  { label: string; bg: string; color: string }
> = {
  on_my_way: { label: "On my way", bg: "#e1f5ee", color: "#0f6e56" },
  wait_for_me: { label: "Wait for me", bg: "#faeeda", color: "#854f0b" },
  at_the_spot: { label: "At the spot", bg: "#eaf3de", color: "#3b6d11" },
  need_help: { label: "Need help", bg: "#fcebeb", color: "#a32d2d" },
};

function StatusBadge({ status }: { status: QuickStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        fontWeight: 500,
        padding: "2px 8px",
        borderRadius: 999,
        background: config.bg,
        color: config.color,
      }}
    >
      {config.label}
    </span>
  );
}

type FamilyPanelProps = {
  open: boolean;
  tripMembers: TripMember[];
  memberStatuses: Record<string, QuickStatus>;
  memberLive: Record<string, MemberLiveData>;
  meetingPoint: MeetingPoint | null;
  isGroupAdmin: boolean;
  currentUserId: string | null;
  currentUserSpeedMph: number;
  onClose: () => void;
  onSetMeetingPoint: () => void;
  onStartConvoy: () => void;
  onQuickStatus: (status: QuickStatus) => void;
};

export function FamilyPanel({
  open,
  tripMembers,
  memberStatuses,
  memberLive,
  meetingPoint,
  isGroupAdmin,
  currentUserId,
  currentUserSpeedMph,
  onClose,
  onSetMeetingPoint,
  onStartConvoy,
  onQuickStatus,
}: FamilyPanelProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: "280px",
        background: "white",
        zIndex: 25,
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s ease",
        borderLeft: "0.5px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "16px",
          borderBottom: "0.5px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 500, color: "#0f172a" }}>Group</span>
        <button type="button" onClick={onClose} aria-label="Close group panel">
          <X size={18} color="#64748b" />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {tripMembers.map((member, index) => {
          const live = memberLive[member.user_id];
          const status = memberStatuses[member.user_id] ?? "on_my_way";
          const memberColor = memberColorForIndex(index);
          const memberBattery = live?.battery_level ?? 100;
          const memberETA =
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
            <div
              key={member.user_id}
              style={{
                padding: "12px 16px",
                borderBottom: "0.5px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: memberColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {member.display_name[0]?.toUpperCase() ?? "?"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#0f172a" }}>
                  {member.display_name}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {memberETA != null ? `~${memberETA} min away` : "Location unknown"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <StatusBadge status={status} />
                {memberBattery <= 20 ? (
                  <div
                    style={{
                      fontSize: 10,
                      color: "#ef4444",
                      marginTop: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 2,
                    }}
                  >
                    <BatteryLow size={10} />
                    {memberBattery}%
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "12px 16px", borderTop: "0.5px solid #e2e8f0" }}>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Your status</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          {(Object.entries(STATUS_CONFIG) as [QuickStatus, (typeof STATUS_CONFIG)[QuickStatus]][]).map(
            ([key, val]) => (
              <button
                key={key}
                type="button"
                onClick={() => onQuickStatus(key)}
                style={{
                  background: val.bg,
                  color: val.color,
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 4px",
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {val.label}
              </button>
            ),
          )}
        </div>
      </div>

      {isGroupAdmin ? (
        <div
          style={{
            padding: "12px 16px",
            borderTop: "0.5px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onSetMeetingPoint}
            style={{
              border: "1px solid #0F766E",
              background: "transparent",
              color: "#0F766E",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <MapPin size={14} />
            Set meeting point
          </button>
          <button
            type="button"
            onClick={onStartConvoy}
            style={{
              border: "1px solid #0F766E",
              background: "transparent",
              color: "#0F766E",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Start convoy
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function FamilyPanelToggle({
  memberCount,
  open,
  onClick,
}: {
  memberCount: number;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Toggle family panel"
      style={{
        position: "absolute",
        right: 12,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 18,
        background: open ? "#0F766E" : "rgba(15,23,42,0.82)",
        color: "#fff",
        border: "none",
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <Users size={14} />
      {open ? "▶" : "◀"} {memberCount}
    </button>
  );
}
