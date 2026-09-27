"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

type SwipeAction = { label: string; bg: string; onClick: () => void };

export function SwipeChatRow({
  children,
  leftActions,
  rightActions,
}: {
  children: ReactNode;
  leftActions: SwipeAction[];
  rightActions: SwipeAction[];
}) {
  const [dx, setDx] = useState(0);
  const [touching, setTouching] = useState(false);
  const startX = useRef(0);
  const originDx = useRef(0);
  const dxLive = useRef(0);
  const w = 56;
  const maxL = leftActions.length * w;
  const maxR = rightActions.length * w;

  const snap = useCallback(
    (x: number) => {
      if (x > 36 && maxL) setDx(maxL);
      else if (x < -36 && maxR) setDx(-maxR);
      else setDx(0);
    },
    [maxL, maxR],
  );

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="absolute inset-y-0 left-0 z-0 flex" style={{ width: maxL || undefined }}>
        {leftActions.map((a, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { a.onClick(); setDx(0); }}
            className="flex shrink-0 items-center justify-center px-1 text-[10px] font-bold text-white"
            style={{ width: w, background: a.bg }}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="absolute inset-y-0 right-0 z-0 flex flex-row-reverse" style={{ width: maxR || undefined }}>
        {rightActions.map((a, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { a.onClick(); setDx(0); }}
            className="flex shrink-0 items-center justify-center px-1 text-[10px] font-bold text-white"
            style={{ width: w, background: a.bg }}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div
        className="relative z-10 bg-white"
        style={{
          transform: `translateX(${dx}px)`,
          transition: touching ? "none" : "transform 0.2s ease-out",
        }}
        onTouchStart={(e) => {
          setTouching(true);
          startX.current = e.touches[0]?.clientX ?? 0;
          originDx.current = dx;
          dxLive.current = dx;
        }}
        onTouchMove={(e) => {
          const x = e.touches[0]?.clientX ?? 0;
          let ndx = originDx.current + (x - startX.current);
          if (ndx > maxL) ndx = maxL;
          if (ndx < -maxR) ndx = -maxR;
          dxLive.current = ndx;
          setDx(ndx);
        }}
        onTouchEnd={() => {
          setTouching(false);
          snap(dxLive.current);
        }}
      >
        {children}
      </div>
    </div>
  );
}
