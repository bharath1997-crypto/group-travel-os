"use client";

import { useEffect, type ReactNode } from "react";

const API_REJECTION_PATTERN =
  /timed out|database might be waking|Failed to fetch|Network error|Could not reach|network request failed|load failed|rovvyApiUnavailable/i;

function isApiUnavailable(reason: unknown): boolean {
  if (
    typeof reason === "object" &&
    reason !== null &&
    "rovvyApiUnavailable" in reason &&
    (reason as { rovvyApiUnavailable?: boolean }).rovvyApiUnavailable
  ) {
    return true;
  }
  const message =
    reason instanceof Error ? reason.message : reason != null ? String(reason) : "";
  return API_REJECTION_PATTERN.test(message);
}

/**
 * Prevents Next.js dev overlay crashes from unhandled API timeout/network rejections.
 * Errors are still logged to the console for debugging.
 */
export function ApiErrorGuard({ children }: { children: ReactNode }) {
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      if (!isApiUnavailable(event.reason)) return;
      event.preventDefault();
      console.warn("[Rovvy] API request failed (backend slow or offline):", event.reason);
    };

    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  return children;
}
