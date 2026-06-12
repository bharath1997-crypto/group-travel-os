"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface ExploreV2SectionProps {
  title: string;
  icon: React.ReactNode;
  seeAllHref: string;
  isEvents?: boolean;
  children: React.ReactNode;
}

export function ExploreV2Section({
  title,
  icon,
  seeAllHref,
  isEvents = false,
  children,
}: ExploreV2SectionProps) {
  return (
    <section className="mb-8">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Icon Box */}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-[#0F766E]">
            {icon}
          </div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
        </div>
        
        {/* See All */}
        <Link
          href={seeAllHref}
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#0F766E] transition hover:text-teal-700"
        >
          See all
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Grid Content */}
      <div className={isEvents ? "grid grid-cols-1 md:grid-cols-4 gap-4" : "grid grid-cols-2 md:grid-cols-5 gap-4"}>
        {children}
      </div>
    </section>
  );
}
