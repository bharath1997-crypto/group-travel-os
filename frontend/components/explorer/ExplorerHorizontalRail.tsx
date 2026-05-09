"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, type ReactNode } from "react";

type ExplorerHorizontalRailProps = {
  id?: string;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function ExplorerHorizontalRail({
  id,
  title,
  subtitle,
  badge,
  rightSlot,
  children,
  className = "",
}: ExplorerHorizontalRailProps) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.85, 360), behavior: "smooth" });
  };

  return (
    <section id={id} className={`mb-12 scroll-mt-28 ${className}`.trim()}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-[#1e4976]/40 pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-white">{title}</h2>
            {badge}
          </div>
          {subtitle ? <p className="mt-1 text-xs text-gray-400">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {rightSlot}
          <div className="hidden items-center gap-0.5 sm:flex">
            <button
              type="button"
              aria-label="Scroll left"
              onClick={() => scroll(-1)}
              className="rounded-lg border border-[#1e4976] bg-[#0d1f33] p-2 text-gray-400 transition hover:border-[#E94560]/45 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Scroll right"
              onClick={() => scroll(1)}
              className="rounded-lg border border-[#1e4976] bg-[#0d1f33] p-2 text-gray-400 transition hover:border-[#E94560]/45 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-[#E94560]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#E94560]">
          Curated
        </span>
        <div
          className="pointer-events-none absolute left-0 top-0 z-10 h-full w-10 bg-gradient-to-r from-[#0B192E] to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-0 top-0 z-10 h-full w-10 bg-gradient-to-l from-[#0B192E] to-transparent"
          aria-hidden
        />
        <div
          ref={ref}
          className="flex gap-4 overflow-x-auto pb-2 pl-0.5 pr-1 pt-9 [-ms-overflow-style:none] [scrollbar-color:#1e4976_#0B192E] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#1e4976] [&::-webkit-scrollbar-track]:bg-[#0B192E]"
        >
          {children}
        </div>
      </div>
    </section>
  );
}
