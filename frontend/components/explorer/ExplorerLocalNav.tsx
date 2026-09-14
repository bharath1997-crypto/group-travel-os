"use client";

import Link from "next/link";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Compass,
  LayoutDashboard,
  Moon,
  Newspaper,
  Radio,
  Sparkles,
  Train,
  UtensilsCrossed,
  Users,
} from "lucide-react";

type ExplorerLocalNavProps = {
  city: string;
};

const wrap =
  "flex items-center gap-2.5 rounded-lg border-l-2 border-transparent py-2.5 pl-3 pr-2 text-[13px] font-medium text-white/65 transition hover:border-white/20 hover:bg-white/5 hover:text-white";

export function ExplorerLocalNav({ city }: ExplorerLocalNavProps) {
  const cityEnc = encodeURIComponent(city || "Chicago");
  return (
    <aside className="sticky top-0 z-20 hidden h-[calc(100dvh-0px)] w-[200px] shrink-0 flex-col border-r border-[#142a45] bg-[#071221] py-6 lg:flex">
      <div className="px-4 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/90">
          Explorer
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        <Link href="/dashboard" className={wrap}>
          <LayoutDashboard className="h-4 w-4 shrink-0 opacity-80" />
          Dashboard
        </Link>
        <Link href="/explore/events" className={`${wrap} border-primary bg-white/5 text-white`}>
          <Compass className="h-4 w-4 shrink-0 text-primary" />
          Cities
        </Link>
        <Link href={`/explore/${cityEnc}/events`} className={wrap}>
          <CalendarDays className="h-4 w-4 shrink-0 opacity-80" />
          Events
        </Link>
        <a href="#wayra-picks" className={wrap}>
          <Sparkles className="h-4 w-4 shrink-0 opacity-80" />
          Wayra picks
        </a>
        <a href="#perfect-groups" className={wrap}>
          <Users className="h-4 w-4 shrink-0 opacity-80" />
          Groups
        </a>
        <a href="#trending-tonight" className={wrap}>
          <Moon className="h-4 w-4 shrink-0 opacity-80" />
          Tonight
        </a>
        <a href="#food-nightlife" className={wrap}>
          <UtensilsCrossed className="h-4 w-4 shrink-0 opacity-80" />
          Food &amp; night
        </a>
        <a href="#top-events" className={wrap}>
          <ClipboardList className="h-4 w-4 shrink-0 opacity-80" />
          Itinerary
        </a>
        <a href="#local-news" className={wrap}>
          <Newspaper className="h-4 w-4 shrink-0 opacity-80" />
          Buzz
        </a>
        <a href="#explorer-culture" className={wrap}>
          <Radio className="h-4 w-4 shrink-0 opacity-80" />
          Audio
        </a>
        <a href="#transport" className={wrap}>
          <Train className="h-4 w-4 shrink-0 opacity-80" />
          Transport
        </a>
        <a href="#attractions" className={wrap}>
          <Building2 className="h-4 w-4 shrink-0 opacity-80" />
          Attractions
        </a>
      </nav>
    </aside>
  );
}
