"use client";

import React, { useId } from "react";
import { Loader2, Mic, Sparkles, Volume2 } from "lucide-react";

import type { WayraVoicePhase } from "@/lib/wayra/use-wayra-voice";

interface WayraIconProps {
  /** Controls subtle motion only — icon shape is unified app-wide. */
  state?: "flying" | "perched";
  size?: number;
  variant?: "fog" | "navy" | "raw" | "launcher" | "inline";
  animate?: boolean;
  className?: string;
}

function SparkleGlyph() {
  return (
    <g>
      <path d="M24 13 L25.35 21.4 L24 29.8 L22.65 21.4 Z" fill="white" />
      <path d="M32.2 24 L23.8 25.35 L15.4 24 L23.8 22.65 Z" fill="white" opacity="0.95" />
      <circle cx="24" cy="24" r="2.6" fill="white" />
    </g>
  );
}

/** Shared AI agent mark — teal disc + sparkle (account-wide Wayra launcher). */
function WayraMark({ px, gradId }: { px: number; gradId: string }) {
  return (
    <svg width={px} height={px} viewBox="0 0 48 48" fill="none" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={gradId} x1="10" y1="6" x2="38" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#14B8A6" />
          <stop offset="0.45" stopColor="#0F766E" />
          <stop offset="1" stopColor="#0A4A3E" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="24" fill={`url(#${gradId})`} />
      <circle
        cx="24"
        cy="24"
        r="22.25"
        stroke="white"
        strokeOpacity="0.28"
        strokeWidth="1.25"
      />
      <SparkleGlyph />
    </svg>
  );
}

function WayraInlineMark({ px }: { px: number }) {
  const icon = Math.round(px * 0.48);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#14B8A6] via-[#0F766E] to-[#0A4A3E] text-white shadow-sm"
      style={{ width: px, height: px }}
      aria-hidden
    >
      <Sparkles width={icon} height={icon} strokeWidth={2.25} />
    </span>
  );
}

export default function WayraIcon({
  state = "flying",
  size = 1,
  variant = "fog",
  animate = true,
  className = "",
}: WayraIconProps) {
  const gradId = useId().replace(/:/g, "");
  const basePx = variant === "inline" ? 28 : variant === "launcher" ? 56 : 48;
  const px = Math.round(basePx * size);

  const animation =
    animate && state === "flying"
      ? "wayra-agent-float 3s ease-in-out infinite"
      : animate && state === "perched"
        ? "wayra-agent-pulse 4s ease-in-out infinite"
        : undefined;

  const shellStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transform: variant === "launcher" || variant === "inline" ? undefined : `scale(${size})`,
    transformOrigin: "center",
    animation,
  };

  let content: React.ReactNode;
  if (variant === "inline" || variant === "navy") {
    content = <WayraInlineMark px={px} />;
  } else if (variant === "launcher" || variant === "raw") {
    content = <WayraMark px={px} gradId={gradId} />;
  } else {
    content = (
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{
          padding: 8,
          background:
            "radial-gradient(ellipse at center, rgba(15,118,110,0.14) 0%, rgba(15,118,110,0.04) 65%, transparent 100%)",
        }}
      >
        <WayraMark px={px} gradId={gradId} />
      </span>
    );
  }

  return (
    <>
      <style>{`
        @keyframes wayra-agent-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes wayra-agent-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.92; }
        }
      `}</style>
      <span style={shellStyle} className={className}>
        {content}
      </span>
    </>
  );
}

function voicePhaseLabel(phase: WayraVoicePhase | undefined, isOpen: boolean): string {
  if (phase === "listening") return "Wayra is listening — tap to stop";
  if (phase === "thinking") return "Wayra is thinking";
  if (phase === "speaking") return "Wayra is speaking";
  return isOpen ? "Close Wayra" : "Talk to Wayra";
}

/** One global Wayra agent orb — same mark in the FAB, chat header, and compact dock. */
export function WayraAgentOrb({
  size = 56,
  voicePhase = "idle",
  className = "",
}: {
  size?: number;
  voicePhase?: WayraVoicePhase;
  className?: string;
}) {
  const gradId = useId().replace(/:/g, "");
  const icon = Math.round(size * 0.42);
  const active = voicePhase === "listening" || voicePhase === "thinking" || voicePhase === "speaking";

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {active ? (
        <span className="pointer-events-none absolute inset-[-6px] rounded-full border border-teal-300/50 animate-ping" />
      ) : (
        <span className="pointer-events-none absolute inset-[-5px] rounded-full bg-[radial-gradient(circle,rgba(20,184,166,0.35)_0%,transparent_70%)]" />
      )}
      <span className="relative z-[1] overflow-hidden rounded-full shadow-[0_10px_28px_rgba(10,74,62,0.42)]">
        <WayraMark px={size} gradId={gradId} />
        {voicePhase === "listening" ? (
          <span className="absolute inset-0 flex items-center justify-center bg-[#0F766E]/25">
            <Mic className="text-white animate-pulse" width={icon} height={icon} strokeWidth={2.4} />
          </span>
        ) : voicePhase === "thinking" ? (
          <span className="absolute inset-0 flex items-center justify-center bg-[#0F766E]/20">
            <Loader2 className="text-white animate-spin" width={icon} height={icon} strokeWidth={2.4} />
          </span>
        ) : voicePhase === "speaking" ? (
          <span className="absolute inset-0 flex items-center justify-center bg-[#0F766E]/20">
            <Volume2 className="text-white animate-pulse" width={icon} height={icon} strokeWidth={2.4} />
          </span>
        ) : null}
      </span>
    </span>
  );
}

/** Standard global Wayra FAB — same on Live map and every tab. */
export function WayraLauncherButton({
  onClick,
  onMouseDown,
  onTouchStart,
  isOpen = false,
  voicePhase = "idle",
  ariaControls,
  className = "",
}: {
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onTouchStart?: (e: React.TouchEvent<HTMLButtonElement>) => void;
  isOpen?: boolean;
  voicePhase?: WayraVoicePhase;
  ariaControls?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      className={`group relative flex h-14 w-14 items-center justify-center rounded-full bg-transparent transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/70 ${className}`}
      title="Drag to move · tap to talk to Wayra"
      aria-label={voicePhaseLabel(voicePhase, isOpen)}
      aria-expanded={isOpen}
      aria-controls={ariaControls}
    >
      <WayraAgentOrb size={52} voicePhase={voicePhase} />
    </button>
  );
}
