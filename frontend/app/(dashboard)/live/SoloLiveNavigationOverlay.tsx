"use client";

import {
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  ParkingCircle,
  Plus,
  Share2,
} from "lucide-react";
import type { PlacePreviewData } from "./PlacePreviewCard";
import type { TripStatus, RouteLine } from "./live-types";
import {
  estimateDriveEta,
  etaMinutesFromDistance,
  formatArrivalTime,
  formatDistanceMiles,
  speedMpsToMph,
} from "./live-types";
import {
  buildNavigationManeuverView,
  type ManeuverKind,
} from "./live-navigation-maneuver";
import {
  LIVE_DOCK_SECTION_LABEL,
  LIVE_NAV_ETA_BAR,
  LIVE_NAV_SPEED_PILL,
  LIVE_NAV_TURN_BANNER,
} from "./live-design-tokens";
import { LIVE_STRIP_HEIGHT_CSS } from "./live-layout";

type Props = {
  destination: PlacePreviewData;
  travelMode: string;
  speedMps: number | null;
  tripStatus: TripStatus;
  onTripStatusChange: (status: TripStatus) => void;
  onEndSoloLive: () => void;
  onSaveParking: () => void;
  onShareTrip: () => void;
  onAddStop: () => void;
  routeLine: RouteLine | null;
};

function ManeuverIcon({ kind }: { kind: ManeuverKind }) {
  const className = "h-6 w-6 text-white";
  if (kind === "left") return <CornerUpLeft className={className} aria-hidden />;
  if (kind === "right") return <CornerUpRight className={className} aria-hidden />;
  return <ArrowUp className={className} aria-hidden />;
}

export default function SoloLiveNavigationOverlay({
  destination,
  travelMode,
  speedMps,
  onEndSoloLive,
  onSaveParking,
  onShareTrip,
  onAddStop,
  routeLine,
}: Props) {
  const speedMph = speedMpsToMph(speedMps);
  const etaMin = etaMinutesFromDistance(destination.distanceM);
  const etaLabel = estimateDriveEta(destination.distanceM);
  const arrival = formatArrivalTime(etaMin);
  const maneuver = buildNavigationManeuverView({
    routeLine,
    destinationName: destination.name,
    remainingDistanceM: destination.distanceM,
  });

  const speedBars = [0, 1, 2, 3].map((i) => speedMph > i * 8);

  return (
    <>
      {/* v3 turn banner */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-[calc(0.45rem+env(safe-area-inset-top,0px))]">
        <div className={`pointer-events-auto ${LIVE_NAV_TURN_BANNER}`}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#12856F] to-[#0A4A3E] shadow-[0_8px_18px_rgba(10,74,62,0.45)]">
              <ManeuverIcon kind={maneuver.kind} />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[17px] font-semibold leading-snug tracking-tight text-white">
                {maneuver.instruction}
              </p>
              <p className={`mt-1 ${LIVE_DOCK_SECTION_LABEL} !text-white/55`}>
                {maneuver.distanceMiLabel} mi · {travelMode}
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-1">
            {maneuver.laneHints.map((lane, i) => (
              <div
                key={i}
                className={`flex h-8 flex-1 items-center justify-center rounded-lg border text-xs transition-colors ${
                  lane.active
                    ? "border-[rgba(18,133,111,0.45)] bg-[rgba(18,133,111,0.18)] font-bold text-[#7FE0C8]"
                    : "border-white/8 bg-white/5 text-white/45"
                }`}
              >
                {lane.arrow}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Speed readout */}
      <div
        className={`pointer-events-auto absolute left-3 z-20 ${LIVE_NAV_SPEED_PILL}`}
        style={{ bottom: `calc(${LIVE_STRIP_HEIGHT_CSS} + 7.5rem + env(safe-area-inset-bottom, 0px))` }}
      >
        <p className="text-2xl font-bold leading-none text-white">{speedMph || "—"}</p>
        <p className={`mt-1 ${LIVE_DOCK_SECTION_LABEL} !text-white/50`}>MPH</p>
        <div className="mt-2 flex gap-0.5">
          {speedBars.map((on, i) => (
            <span
              key={i}
              className={`h-1 w-3.5 rounded-full ${on ? "bg-[#12856F]" : "bg-white/20"}`}
            />
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div
        className="pointer-events-auto absolute inset-x-3 z-20 flex justify-center gap-2"
        style={{ bottom: `calc(${LIVE_STRIP_HEIGHT_CSS} + 4.75rem + env(safe-area-inset-bottom, 0px))` }}
      >
        {[
          { label: "Parking", icon: ParkingCircle, onClick: onSaveParking },
          { label: "Share", icon: Share2, onClick: onShareTrip },
          { label: "Add stop", icon: Plus, onClick: onAddStop },
        ].map(({ label, icon: Icon, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[rgba(9,17,24,0.78)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 shadow-[0_6px_18px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:bg-[rgba(9,17,24,0.92)] active:scale-[0.98]"
          >
            <Icon className="h-3.5 w-3.5 text-[#7FE0C8]" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* v3 bottom ETA bar */}
      <div
        className="pointer-events-auto absolute inset-x-0 z-20"
        style={{ bottom: `calc(${LIVE_STRIP_HEIGHT_CSS} + env(safe-area-inset-bottom, 0px))` }}
      >
        <div className={LIVE_NAV_ETA_BAR}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={LIVE_DOCK_SECTION_LABEL}>Heading to</p>
              <p className="truncate font-serif text-lg leading-tight text-[#0F1614]">
                {destination.name}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[#F1EFE8] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#0E6E5C]">
              Solo Live
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="grid flex-1 grid-cols-3 gap-2 border-r border-[rgba(15,22,20,0.08)] pr-3 text-center">
              <div>
                <p className="text-base font-bold leading-tight text-[#0F1614]">{etaLabel}</p>
                <p className={`mt-0.5 ${LIVE_DOCK_SECTION_LABEL}`}>ETA</p>
              </div>
              <div>
                <p className="text-base font-bold leading-tight text-[#0F1614]">
                  {formatDistanceMiles(destination.distanceM)}
                </p>
                <p className={`mt-0.5 ${LIVE_DOCK_SECTION_LABEL}`}>Left</p>
              </div>
              <div>
                <p className="text-base font-bold leading-tight text-[#0F1614]">{arrival}</p>
                <p className={`mt-0.5 ${LIVE_DOCK_SECTION_LABEL}`}>Arrive</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onEndSoloLive}
              className="shrink-0 rounded-full bg-[#B4453D] px-5 py-3 text-xs font-bold uppercase tracking-wide text-white shadow-[0_8px_20px_rgba(180,69,61,0.35)] transition hover:bg-[#9A3A33] active:scale-[0.98]"
            >
              End
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
