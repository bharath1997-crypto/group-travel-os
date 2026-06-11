"use client";

import dynamic from "next/dynamic";

const ExploreMap = dynamic(
  () =>
    import("@/components/explore/ExploreMap").then((mod) => mod.ExploreMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[50vh] items-center justify-center bg-white text-sm text-slate-500">
        Loading map…
      </div>
    ),
  },
);

export default function ExploreMapPage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-white">
      <ExploreMap />
    </div>
  );
}
