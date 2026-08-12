"use client";

import { ApiErrorGuard } from "@/components/ApiErrorGuard";
import { installMapLibreAbortNoiseGuard } from "@/lib/maplibre-abort-noise";
import type { ReactNode } from "react";

installMapLibreAbortNoiseGuard();

export function ClientProviders({ children }: { children: ReactNode }) {
  return <ApiErrorGuard>{children}</ApiErrorGuard>;
}
