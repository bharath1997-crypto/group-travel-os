"use client";

type WayraLiveWireProps = {
  phase: "listening" | "thinking" | "speaking";
  transcript: string;
  onStop: () => void;
};

function labelFor(phase: WayraLiveWireProps["phase"]): string {
  if (phase === "thinking") return "Thinking";
  if (phase === "speaking") return "Speaking";
  return "Live on the wire";
}

export function WayraLiveWire({ phase, transcript, onStop }: WayraLiveWireProps) {
  return (
    <div className="shrink-0 border-b border-black/[0.05] bg-[#E8F3EE] px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-[#0F3D32]">
          {labelFor(phase)}
        </p>
        {phase === "listening" ? (
          <button
            type="button"
            onClick={onStop}
            className="rounded-full bg-[#0F3D32] px-3 py-1 text-[11px] font-semibold text-white"
          >
            Stop and answer
          </button>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-start gap-2">
        {phase === "listening" ? (
          <span className="mt-1 flex h-3 items-end gap-0.5" aria-hidden>
            {[6, 10, 7, 12, 8].map((h, i) => (
              <span
                key={i}
                className="w-0.5 animate-pulse rounded-full bg-[#0F3D32]"
                style={{ height: h, animationDelay: `${i * 80}ms` }}
              />
            ))}
          </span>
        ) : null}
        <p className="min-w-0 flex-1 font-display text-[18px] leading-snug tracking-[-0.02em] text-[#0F1614]">
          {transcript.trim()
            ? `“${transcript.trim()}”`
            : phase === "listening"
              ? "Listening…"
              : phase === "thinking"
                ? "Working it out…"
                : "Reading the answer…"}
        </p>
      </div>
    </div>
  );
}
