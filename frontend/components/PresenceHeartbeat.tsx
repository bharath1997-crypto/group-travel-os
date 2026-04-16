"use client";

import { useEffect } from "react";

import { apiFetch } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

/**
 * Marks the user as active on the web for group member lists (green / last seen).
 */
export function PresenceHeartbeat() {
  useEffect(() => {
    if (!isLoggedIn()) return;

    function tick() {
      void apiFetch("/auth/presence", { method: "POST" }).catch(() => {});
    }

    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
