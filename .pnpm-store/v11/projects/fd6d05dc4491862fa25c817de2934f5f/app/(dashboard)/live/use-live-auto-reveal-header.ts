"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TOP_EDGE_PX = 36;
const HIDE_DELAY_MS = 750;

type UseLiveAutoRevealHeaderOptions = {
  enabled: boolean;
  headerPx: number;
};

export function useLiveAutoRevealHeader(options: UseLiveAutoRevealHeaderOptions) {
  const { enabled, headerPx } = options;
  const [revealed, setRevealed] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reveal = useCallback(() => {
    if (!enabled) return;
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setRevealed(true);
  }, [enabled]);

  const scheduleHide = useCallback(() => {
    if (!enabled) return;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setRevealed(false);
      hideTimerRef.current = null;
    }, HIDE_DELAY_MS);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setRevealed(false);
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.clientY <= TOP_EDGE_PX) {
        reveal();
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (y != null && y <= TOP_EDGE_PX + 12) reveal();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("touchstart", onTouchStart);
    };
  }, [enabled, reveal]);

  useEffect(() => {
    if (!enabled) {
      document.body.classList.remove("live-header-revealed");
      return;
    }

    if (revealed) document.body.classList.add("live-header-revealed");
    else document.body.classList.remove("live-header-revealed");
  }, [enabled, revealed]);

  useEffect(() => {
    if (!enabled) return;
    const headerH = revealed ? headerPx : 0;
    document.documentElement.style.setProperty("--rovvy-header-h", `${headerH}px`);
  }, [enabled, headerPx, revealed]);

  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  return { revealed, reveal, scheduleHide };
}
