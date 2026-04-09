"use client";

import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[280px] w-full items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">
      Loading map…
    </div>
  ),
});

export default function MapPage() {
  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col gap-1 px-4 pb-4 pt-2 md:h-[calc(100dvh-3.5rem)] md:gap-2 md:px-6 md:pt-3">
      <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
        My Map
      </p>
      <div className="min-h-0 flex-1">
        <MapComponent />
      </div>
    </div>
  );
}
