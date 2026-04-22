"use client";

const BORDER = "#E9ECEF";

type Variant = "trips-grid" | "trip-detail" | "generic";

export function LoadingSkeleton({
  variant = "generic",
  className = "",
}: {
  variant?: Variant;
  className?: string;
}) {
  if (variant === "trips-grid") {
    return (
      <ul
        className={`mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${className}`}
        aria-busy
        aria-label="Loading trips"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <li
            key={i}
            className="overflow-hidden rounded-2xl border bg-white shadow-sm"
            style={{ borderColor: BORDER }}
          >
            <div className="h-20 animate-pulse bg-gradient-to-r from-[#0F3460]/30 to-[#E94560]/30" />
            <div className="space-y-3 p-3.5">
              <div className="h-4 w-3/4 animate-pulse rounded bg-[#E9ECEF]" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-[#E9ECEF]" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-[#E9ECEF]" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (variant === "trip-detail") {
    return (
      <div
        className={`flex min-h-[50vh] flex-col gap-4 p-4 ${className}`}
        aria-busy
        aria-label="Loading trip"
      >
        <div className="h-8 w-32 animate-pulse rounded bg-[#E9ECEF]" />
        <div className="h-36 w-full animate-pulse rounded-2xl bg-[#E9ECEF]" />
        <div className="flex gap-2 overflow-hidden border-b pb-2" style={{ borderColor: BORDER }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-24 shrink-0 animate-pulse rounded bg-[#E9ECEF]"
            />
          ))}
        </div>
        <div className="h-40 w-full animate-pulse rounded-2xl bg-[#E9ECEF]" />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center gap-3 py-12 ${className}`}>
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-[#E9ECEF] border-t-[#E94560]"
        aria-hidden
      />
      <span className="text-sm text-[#6C757D]">Loading…</span>
    </div>
  );
}
