"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import BrandedLoading from "@/components/BrandedLoading";

/** Canonical entry for new group creation — hands off to Travel Hub create modal. */
export default function NewGroupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/travel-hub?action=create-group");
  }, [router]);

  return (
    <BrandedLoading
      fullScreen={false}
      message="Opening group creation…"
    />
  );
}
