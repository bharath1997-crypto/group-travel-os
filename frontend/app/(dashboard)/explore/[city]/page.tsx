"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CityTravelGuidePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/explorer");
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-[#0B192E] text-gray-300">
      <p className="text-sm">Redirecting to Explorer…</p>
    </div>
  );
}
