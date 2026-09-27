"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import BrandedLoading from "@/components/BrandedLoading";
import { emitOpenLounge } from "@/lib/open-lounge";

/** Opens group creation in the independent Rovvy Lounge dock popup. */
export default function NewGroupPage() {
  const router = useRouter();

  useEffect(() => {
    emitOpenLounge({ createGroup: true });
    router.replace("/explore");
  }, [router]);

  return (
    <BrandedLoading
      fullScreen={false}
      message="Opening group creation…"
    />
  );
}
