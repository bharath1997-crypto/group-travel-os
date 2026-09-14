"use client";

import {
  Armchair,
  Bike,
  Car,
  Compass,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { PlacePreviewData } from "./PlacePreviewCard";
import {
  EXTENDED_TRAVEL_MODES,
  type GroundTravelMode,
} from "./live-types";
import {
  LIVE_DOCK_PANEL,
  LIVE_DOCK_PRIMARY_CTA,
  LIVE_DOCK_SECTION_LABEL,
  LIVE_DOCK_NESTED_SURFACE,
} from "./live-design-tokens";

const GROUND_MODES = EXTENDED_TRAVEL_MODES.filter((m) => !m.comingSoon);

const TRAVEL_MODE_ICONS: Record<GroundTravelMode, LucideIcon> = {
  Drive: Car,
  Bike: Bike,
  Trek: Compass,
  Walk: User,
};

export const LIVE_WORKFLOW_OPTIONS = [
  {
    id: "Solo" as const,
    subtitle: "Route, nav, saves. Just you.",
  },
  {
    id: "Group Travel" as const,
    subtitle: "Meet point, live ETAs, votes, split",
  },
  {
    id: "Seat Share" as const,
    subtitle: "Empty seats, pickup points, cost per head",
  },
];

const WORKFLOW_ICONS: Record<(typeof LIVE_WORKFLOW_OPTIONS)[number]["id"], LucideIcon> = {
  Solo: User,
  "Group Travel": Users,
  "Seat Share": Armchair,
};

const SETUP_ICON_CLASS = "h-4 w-4 shrink-0 text-[#0F1614]";

export type LiveWorkflowType = (typeof LIVE_WORKFLOW_OPTIONS)[number]["id"];

type LiveSetupPanelProps = {
  travelMode: GroundTravelMode;
  onTravelModeChange: (mode: GroundTravelMode) => void;
  workflowType: LiveWorkflowType;
  onWorkflowTypeChange: (workflow: LiveWorkflowType) => void;
  destination: PlacePreviewData | null;
  onSetDestination: () => void;
  user: { id?: string | number } | null;
  routePreviewStatus: "idle" | "loading" | "ready" | "failed";
  routeLoading: boolean;
  activeRoute: unknown;
  onSignIn: () => void;
  onStartLive: () => void;
  onToast: (message: string) => void;
  onSolveMeetPoint?: () => void;
  groupMemberCount?: number;
};

export default function LiveSetupPanel({
  travelMode,
  onTravelModeChange,
  workflowType,
  onWorkflowTypeChange,
  destination,
  onSetDestination,
  user,
  routePreviewStatus,
  routeLoading,
  activeRoute,
  onSignIn,
  onStartLive,
  onToast,
  onSolveMeetPoint,
  groupMemberCount = 6,
}: LiveSetupPanelProps) {
  const isGroup = workflowType === "Group Travel";
  const startDisabled =
    routePreviewStatus !== "ready" || !activeRoute || routeLoading;
  const groupCountLabel = Math.max(groupMemberCount, 1);

  const startLabel =
    routeLoading || routePreviewStatus === "loading"
      ? "Loading route..."
      : workflowType === "Solo"
        ? "Start Solo Live"
        : workflowType === "Group Travel"
          ? `Start Group Live — ${groupCountLabel} people`
          : "Start Seat Share Live";

  return (
    <div className={`flex flex-col gap-4 p-[18px] text-[#0F1614] ${LIVE_DOCK_PANEL}`}>
      <div>
        <p className={`mb-2.5 ${LIVE_DOCK_SECTION_LABEL}`}>Travel mode</p>
        <div className="grid grid-cols-4 gap-1.5">
          {GROUND_MODES.map((mode) => {
            const isActive = travelMode === mode.id;
            const ModeIcon = TRAVEL_MODE_ICONS[mode.id as GroundTravelMode];
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => onTravelModeChange(mode.id as GroundTravelMode)}
                className={`flex h-10 flex-col items-center justify-center gap-0.5 rounded-[14px] border text-[10px] font-bold transition-all ${
                  isActive
                    ? "border-primary bg-primary-soft text-primary shadow-sm"
                    : "border-[rgba(15,22,20,0.12)] bg-white text-[#2A312B] hover:border-[rgba(15,22,20,0.2)]"
                }`}
              >
                <ModeIcon className={SETUP_ICON_CLASS} strokeWidth={1.9} aria-hidden />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className={`mb-2.5 ${LIVE_DOCK_SECTION_LABEL}`}>Workflow</p>
        <div className="flex flex-col gap-1.5">
          {LIVE_WORKFLOW_OPTIONS.map((option) => {
            const isActive = workflowType === option.id;
            const WorkflowIcon = WORKFLOW_ICONS[option.id];
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onWorkflowTypeChange(option.id)}
                className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all ${
                  isActive
                    ? "border-primary bg-primary-soft/80"
                    : "border-[rgba(15,22,20,0.12)] bg-white hover:border-[rgba(15,22,20,0.2)]"
                }`}
              >
                <WorkflowIcon className={SETUP_ICON_CLASS} strokeWidth={1.9} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[13.5px] font-semibold ${
                      isActive ? "text-primary" : "text-[#0F1614]"
                    }`}
                  >
                    {option.id}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-[#5F665F]">
                    {option.subtitle}
                  </span>
                </span>
                {option.id === "Group Travel" ? (
                  <span className="shrink-0 font-mono text-[8.5px] uppercase tracking-[0.1em] text-primary">
                    {groupCountLabel} in
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className={`mb-2.5 ${LIVE_DOCK_SECTION_LABEL}`}>Destination</p>
        <div className="flex items-center gap-3 rounded-[14px] border border-[rgba(15,22,20,0.1)] bg-white px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-[13.5px] ${
                destination ? "font-medium text-[#0F1614]" : "text-[#5F665F]"
              }`}
            >
              {destination ? destination.name : "No destination set"}
            </p>
            {destination?.address ? (
              <p className="mt-0.5 truncate text-[11px] text-[#5F665F]">{destination.address}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onSetDestination}
            className="shrink-0 text-[12.5px] font-bold text-primary hover:underline"
          >
            {destination ? "Change" : "Set"}
          </button>
        </div>
      </div>

      {isGroup ? (
        <div className={`p-3.5 ${LIVE_DOCK_NESTED_SURFACE}`}>
          <div className="mb-3 flex items-center gap-3">
            <div className="flex items-center">
              {["AR", "TK", "SM"].map((initials, index) => (
                <span
                  key={initials}
                  className={`flex h-[25px] w-[25px] items-center justify-center rounded-full border-2 border-[#F1EFE8] bg-white text-[9px] font-bold text-[#5A615A] ${
                    index > 0 ? "-ml-2" : ""
                  }`}
                >
                  {initials}
                </span>
              ))}
              <span className="-ml-2 flex h-[25px] w-[25px] items-center justify-center rounded-full border-2 border-[#F1EFE8] bg-[#ECE9E1] text-[9px] font-bold text-[#5A615A]">
                +3
              </span>
            </div>
            <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-[#3A423B]">
              Six people, four origins. Rovvy solves the meet point.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onSolveMeetPoint?.();
              onToast("Meet point solver — coming in Group Live phase.");
            }}
            className="w-full rounded-full border border-[rgba(15,22,20,0.16)] bg-white py-2.5 text-[12.5px] font-semibold text-[#0F1614] transition hover:border-[#0F1614]"
          >
            Solve the fairest meet point
          </button>
        </div>
      ) : null}

      <div className="pt-1">
        {!user ? (
          <div className="text-center">
            <button
              type="button"
              onClick={onSignIn}
              className="text-[12.5px] font-bold text-primary hover:underline"
            >
              Sign in to start
            </button>
            <p className="mt-2.5 text-center text-[11.5px] text-[#5F665F]">
              Browse free. Sign in only to go live.
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onStartLive}
              disabled={startDisabled}
              className={LIVE_DOCK_PRIMARY_CTA}
            >
              {startLabel}
            </button>
            <p className="mt-2.5 text-center text-[11.5px] text-[#5F665F]">
              Browse free. Sign in only to go live.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
