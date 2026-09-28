"use client";

import { WAYRA_HEADLINE, WAYRA_TRY_LABEL } from "@/lib/wayra/wayra-chat-tokens";

export function WayraListeningView({
  transcript,
  onStop,
}: {
  transcript: string;
  onStop: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-8 flex h-12 items-end justify-center gap-1.5 text-[#0F3D32]" aria-hidden>
        {[10, 22, 16, 28, 14, 24, 12].map((h, i) => (
          <span
            key={i}
            className="w-1.5 origin-bottom rounded-full bg-[#0F3D32] animate-pulse"
            style={{
              height: h,
              animationDelay: `${i * 90}ms`,
              animationDuration: "900ms",
            }}
          />
        ))}
      </div>
      <p className={WAYRA_TRY_LABEL}>Heard so far</p>
      <p className={`${WAYRA_HEADLINE} mt-1 max-w-[20rem]`}>
        “{transcript.trim() || "…"}”
      </p>
      <button
        type="button"
        onClick={onStop}
        className="mt-10 w-full max-w-[20rem] rounded-full border border-black/[0.08] bg-white py-3.5 text-[15px] font-medium text-[#0F1614] transition hover:bg-[#EFEDE8]"
      >
        Stop and answer
      </button>
    </div>
  );
}
