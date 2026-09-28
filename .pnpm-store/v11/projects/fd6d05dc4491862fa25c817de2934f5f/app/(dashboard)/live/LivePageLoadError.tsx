"use client";

type LivePageLoadErrorProps = {
  onRetry: () => void;
  detail?: string | null;
};

export default function LivePageLoadError({ onRetry, detail }: LivePageLoadErrorProps) {
  const showDetail = Boolean(detail && process.env.NODE_ENV === "development");

  return (
    <div className="fixed inset-0 z-[1] flex flex-col items-center justify-center gap-3 bg-[#F8FAFC] p-6 text-center">
      <p className="text-sm font-semibold text-[#0F1614]">Live could not load</p>
      {showDetail ? (
        <p className="max-w-md rounded-lg bg-[#F1EFE8] px-3 py-2 font-mono text-[11px] leading-relaxed text-[#0F1614]">
          {detail}
        </p>
      ) : null}
      <p className="max-w-sm text-xs leading-relaxed text-[#5F665F]">
        {showDetail
          ? "Fix the error above, then retry or hard-refresh."
          : "The Live map bundle timed out or was stale after a dev reload. Retry, hard-refresh, or restart"}{" "}
        {!showDetail ? (
          <>
            <code className="rounded bg-[#F1EFE8] px-1 py-0.5">npm run dev</code>.
          </>
        ) : null}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105"
      >
        Retry Live
      </button>
    </div>
  );
}
