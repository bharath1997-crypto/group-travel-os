"use client";

import { AlertTriangle, Mic, Volume2, VolumeX } from "lucide-react";
import type { RouteAlertItem } from "@/lib/live/types";
import {
  formatInstruction,
  formatNavDistance,
  type RouteStep,
} from "@/lib/live/navigation";
import { speakWayra } from "@/lib/live/wayra-voice";

const PANEL_BG = "rgba(15, 23, 42, 0.85)";

export type DriverModeProps = {
  currentStep: RouteStep | null;
  nextStep: RouteStep | null;
  distanceToNextTurn: number;
  currentSpeed: number;
  speedLimit: number | null;
  roadName: string | null;
  activeAlert: RouteAlertItem | null;
  destination: { name: string } | null;
  onExitDriverMode: () => void;
  onWayraTap: () => void;
  onSOSPressStart: () => void;
  onSOSPressEnd: () => void;
  sosHoldProgress: number;
  navigationActive: boolean;
  eta: string | null;
  voiceMuted: boolean;
  onToggleMute: () => void;
  wayraListening: boolean;
  arrived: boolean;
};

function maneuverSymbol(maneuverType: string | undefined): string {
  const type = (maneuverType || "straight").toLowerCase();
  if (type.includes("left")) return "↰";
  if (type.includes("right")) return "↱";
  if (type.includes("roundabout") || type.includes("rotary")) return "↻";
  if (type.includes("arrive")) return "⊙";
  return "↑";
}

function alertLabel(alert: RouteAlertItem): string {
  const miles = `${alert.distance_miles.toFixed(1)} mi`;
  if (alert.report_type === "police") {
    if (alert.minutes_away != null) {
      return `🚔 Police · ${miles} · ${Math.round(alert.minutes_away)} min`;
    }
    return `🚔 Police · ${miles}`;
  }
  if (alert.report_type === "accident") {
    return `🚗 Accident · ${miles}`;
  }
  if (alert.report_type === "closure") {
    return `⛔ Road closed · ${miles}`;
  }
  return alert.message;
}

export function DriverModeOverlay({
  currentStep,
  nextStep,
  distanceToNextTurn,
  currentSpeed,
  speedLimit,
  roadName,
  activeAlert,
  destination,
  onExitDriverMode,
  onWayraTap,
  onSOSPressStart,
  onSOSPressEnd,
  sosHoldProgress,
  navigationActive,
  eta,
  voiceMuted,
  onToggleMute,
  wayraListening,
  arrived,
}: DriverModeProps) {
  const displayStep = nextStep || currentStep;
  const speedColor =
    speedLimit != null && currentSpeed > speedLimit
      ? "text-red-400"
      : speedLimit != null && currentSpeed >= speedLimit - 5
        ? "text-amber-400"
        : "text-white";

  const centerLabel = roadName
    ? roadName.length > 20
      ? `${roadName.slice(0, 20)}…`
      : roadName
    : eta
      ? `ETA ${eta}`
      : "Driving";

  return (
    <div className="pointer-events-none fixed inset-0 z-[145] flex flex-col">
      {/* Top bar — 48px */}
      <div
        className="pointer-events-auto flex h-12 shrink-0 items-center justify-between px-4 pt-[max(0px,env(safe-area-inset-top))]"
        style={{ backgroundColor: PANEL_BG }}
      >
        <button
          type="button"
          onClick={onExitDriverMode}
          className="text-sm font-semibold text-white"
        >
          ← EXIT
        </button>
        <p className="max-w-[50%] truncate text-sm font-medium text-white">{centerLabel}</p>
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={voiceMuted ? "Unmute voice" : "Mute voice"}
          className="text-white"
        >
          {voiceMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>

      {/* Map window — flexible, transparent */}
      <div className="min-h-0 flex-1" />

      {/* Bottom panels */}
      <div className="pointer-events-auto shrink-0 pb-[max(0px,env(safe-area-inset-bottom))]">
        {/* Next turn — 100px */}
        <div
          className="flex h-[100px] items-center gap-4 px-4"
          style={{ backgroundColor: PANEL_BG }}
        >
          <div className="flex h-16 w-16 shrink-0 items-center justify-center text-4xl text-white">
            {arrived ? (
              <span className="text-2xl font-bold text-green-400">✓</span>
            ) : (
              maneuverSymbol(displayStep?.maneuver_type)
            )}
          </div>
          <div className="min-w-0 flex-1">
            {arrived ? (
              <p className="text-2xl font-bold text-green-400">You have arrived</p>
            ) : navigationActive && displayStep ? (
              <>
                <p className="truncate text-2xl font-bold text-white">
                  {formatInstruction(displayStep)}
                </p>
                {displayStep.name ? (
                  <p className="truncate text-lg text-white/90">{displayStep.name}</p>
                ) : null}
                <p className="text-xl font-bold text-[#5EEAD4]">
                  in {formatNavDistance(distanceToNextTurn)}
                </p>
              </>
            ) : (
              <>
                <p className="truncate text-xl font-bold text-white">
                  {destination?.name || "No destination set"}
                </p>
                <p className="text-sm text-white/70">Set a destination to navigate</p>
              </>
            )}
          </div>
        </div>

        {/* Speed + limit — 100px */}
        <div
          className="flex h-[100px] items-center px-4"
          style={{ backgroundColor: PANEL_BG }}
        >
          <div className="flex flex-1 items-end gap-2">
            <span className={`text-[72px] font-bold leading-none tabular-nums ${speedColor}`}>
              {currentSpeed}
            </span>
            <span className="mb-3 text-base text-white/80">mph</span>
          </div>
          <div className="mx-4 h-16 w-px bg-white/20" />
          <div className="flex flex-1 flex-col items-center justify-center">
            {speedLimit != null ? (
              <>
                <span className="text-xs font-semibold uppercase tracking-wide text-white/70">
                  Limit
                </span>
                <div className="relative mt-1 flex h-14 w-14 items-center justify-center">
                  <div
                    className="absolute inset-0 bg-white"
                    style={{
                      clipPath:
                        "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
                    }}
                  />
                  <span className="relative text-3xl font-bold text-stone-900">
                    {speedLimit}
                  </span>
                </div>
              </>
            ) : (
              <span className="text-sm text-white/50">—</span>
            )}
          </div>
        </div>

        {/* Alert bar — 48px */}
        {activeAlert ? (
          <button
            type="button"
            onClick={() => speakWayra(activeAlert.message)}
            className={`flex h-12 w-full items-center justify-center px-4 text-sm font-semibold text-white ${
              activeAlert.tier === "immediate" ||
              activeAlert.report_type === "closure"
                ? "bg-red-600/95"
                : "bg-amber-500/95"
            }`}
          >
            {alertLabel(activeAlert)}
          </button>
        ) : (
          <div className="h-0" />
        )}

        {/* Action buttons — 88px */}
        <div
          className="flex h-[88px] items-center justify-between px-[6%]"
          style={{ backgroundColor: PANEL_BG }}
        >
          <button
            type="button"
            onClick={onWayraTap}
            className={`relative flex h-[72px] w-[44%] flex-col items-center justify-center rounded-2xl ${
              wayraListening ? "animate-pulse bg-red-600" : "bg-[#0F766E]"
            }`}
          >
            <Mic size={32} className="text-white" />
            <span className="mt-1 text-sm font-bold text-white">
              {wayraListening ? "LISTENING" : "WAYRA"}
            </span>
          </button>

          <button
            type="button"
            aria-label="Hold for 3 seconds to trigger SOS"
            onPointerDown={onSOSPressStart}
            onPointerUp={onSOSPressEnd}
            onPointerLeave={onSOSPressEnd}
            onPointerCancel={onSOSPressEnd}
            className="relative flex h-[72px] w-[44%] flex-col items-center justify-center rounded-2xl bg-red-600 touch-none"
          >
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 72 72"
              aria-hidden
            >
              <circle
                cx="36"
                cy="36"
                r="32"
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="3"
              />
              <circle
                cx="36"
                cy="36"
                r="32"
                fill="none"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={201}
                strokeDashoffset={201 - (201 * sosHoldProgress) / 100}
                transform="rotate(-90 36 36)"
              />
            </svg>
            <AlertTriangle size={32} className="relative text-white" />
            <span className="relative mt-1 text-sm font-bold text-white">SOS</span>
          </button>
        </div>
      </div>
    </div>
  );
}
