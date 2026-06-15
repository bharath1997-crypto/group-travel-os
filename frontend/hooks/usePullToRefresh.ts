"use client";

import { useCallback, useRef, useState, type TouchEvent } from "react";

export function usePullToRefresh(onRefresh: () => void | Promise<void>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pullStartY = useRef(0);
  const [pullDist, setPullDist] = useState(0);

  const onTouchStart = useCallback((e: TouchEvent) => {
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0) return;
    pullStartY.current = e.touches[0]?.clientY ?? 0;
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0) return;
    const y = e.touches[0]?.clientY ?? 0;
    const dy = y - pullStartY.current;
    if (dy > 0) setPullDist(Math.min(dy, 88));
  }, []);

  const onTouchEnd = useCallback(() => {
    if (pullDist >= 60) void onRefresh();
    setPullDist(0);
  }, [pullDist, onRefresh]);

  return { scrollRef, pullDist, onTouchStart, onTouchMove, onTouchEnd };
}
