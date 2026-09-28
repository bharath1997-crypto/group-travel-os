"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { INTERNAL_FLIGHT_CHECKOUT_ENABLED } from "@/lib/flight-product-mode";

export default function OfferDetailPage() {
  const router = useRouter();

  useEffect(() => {
    if (!INTERNAL_FLIGHT_CHECKOUT_ENABLED) {
      router.replace("/flights");
    }
  }, [router]);

  if (!INTERNAL_FLIGHT_CHECKOUT_ENABLED) {
    return null;
  }

  return null;
}
