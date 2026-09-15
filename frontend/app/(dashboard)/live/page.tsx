"use client";

import dynamic from "next/dynamic";

const LivePageClient = dynamic(() => import("./LivePageClient"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[1] flex items-center justify-center bg-[#F8FAFC] text-sm font-medium text-[#5F665F]">
      Loading Live…
    </div>
  ),
});

export default function LivePage() {
  return <LivePageClient />;
}
