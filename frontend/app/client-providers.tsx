"use client";

import { ApiErrorGuard } from "@/components/ApiErrorGuard";
import type { ReactNode } from "react";

export function ClientProviders({ children }: { children: ReactNode }) {
  return <ApiErrorGuard>{children}</ApiErrorGuard>;
}
