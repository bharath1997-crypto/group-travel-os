"use client";

import { ChevronUp, Volume2, X } from "lucide-react";

import { WayraAgentOrb } from "@/components/ui/WayraIcon";
import type { WayraVoicePhase } from "@/lib/wayra/use-wayra-voice";

type WayraAgentDockProps = {
  phase: WayraVoicePhase;
  interimTranscript?: string;
  lastReply?: string | null;
  onExpand: () => void;
  onTalk: () => void;
  onClose: () => void;
};

function dockStatus(phase: WayraVoicePhase, interim: string, lastReply: string | null): string {
  if (phase === "listening") return interim.trim() || "Listening…";
  if (phase === "thinking") return "Thinking…";
  if (phase === "speaking") return lastReply?.trim() || "Speaking…";
  return lastReply?.trim() || "Tap to talk — Wayra hears you in English";
}

export function WayraAgentDock({
  phase,
  interimTranscript = "",
  lastReply = null,
  onExpand,
  onTalk,
  onClose,
}: WayraAgentDockProps) {
  const status = dockStatus(phase, interimTranscript, lastReply);
  const active = phase === "listening" || phase === "thinking" || phase === "speaking";

  return (
    <div className="pointer-events-auto flex max-w-[min(22rem,calc(100vw-2rem))] items-center gap-2 rounded-full border border-white/70 bg-white/95 py-1.5 pl-1.5 pr-2 shadow-[0_12px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl">
      <button
        type="button"
        onClick={onTalk}
        className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
        aria-label={active ? "Stop or continue Wayra voice" : "Talk to Wayra"}
      >
        <WayraAgentOrb size={44} voicePhase={phase} />
      </button>
      <button
        type="button"
        onClick={onExpand}
        className="min-w-0 flex-1 text-left focus:outline-none"
        aria-label="Open Wayra chat"
      >
        <p className="text-[11px] font-semibold tracking-wide text-[#0F766E]">
          {phase === "speaking" ? (
            <span className="inline-flex items-center gap-1">
              <Volume2 className="h-3 w-3" />
              Wayra
            </span>
          ) : (
            "Wayra"
          )}
        </p>
        <p className="truncate text-[12px] leading-snug text-stone-600">{status}</p>
      </button>
      <button
        type="button"
        onClick={onExpand}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-500 transition hover:bg-teal-50 hover:text-[#0F766E]"
        title="Open chat"
        aria-label="Open Wayra chat"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onClose}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
        title="Close Wayra"
        aria-label="Close Wayra"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
