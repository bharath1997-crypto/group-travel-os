"use client";

import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef, type ReactNode } from "react";

type ExplorerCarouselProps = {
  title: string;
  subtitle?: string;
  seeAllHref?: string;
  seeAllLabel?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function ExplorerCarousel({
  title,
  subtitle,
  seeAllHref,
  seeAllLabel = "See all",
  rightSlot,
  children,
  className = "",
}: ExplorerCarouselProps) {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    ref.current?.scrollBy({ left: dir * 240, behavior: "smooth" });
  };

  return (
    <div className={className}>
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-slate-500 text-xs mt-0.5 font-medium">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {rightSlot}
          {seeAllHref && (
            <Link
              href={seeAllHref}
              className="text-primary hover:text-primary-hover font-bold text-sm flex items-center gap-1 group whitespace-nowrap"
            >
              {seeAllLabel}
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
          <div className="hidden sm:flex items-center gap-1 ml-1">
            <button
              onClick={() => scroll(-1)}
              aria-label="Scroll left"
              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:border-primary hover:text-primary transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => scroll(1)}
              aria-label="Scroll right"
              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:border-primary hover:text-primary transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:thin] [scrollbar-color:#CBD5E1_#F1F5F9] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-slate-100"
      >
        {children}
      </div>
    </div>
  );
}
