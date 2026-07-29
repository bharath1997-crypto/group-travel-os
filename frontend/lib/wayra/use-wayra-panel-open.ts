"use client";

import { useEffect, useState } from "react";

/** True while the Wayra sidecar panel is open (Live + dashboard). */
export function useWayraPanelOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onState = (e: Event) => {
      const ce = e as CustomEvent<{ isOpen?: boolean }>;
      setOpen(Boolean(ce.detail?.isOpen));
    };
    window.addEventListener("rovvy:wayra-state", onState as EventListener);
    return () =>
      window.removeEventListener("rovvy:wayra-state", onState as EventListener);
  }, []);

  return open;
}
