"use client";

import Link from "next/link";
import { OpenLoungeButton } from "@/components/lounge/OpenLoungeButton";

export default function GroupHubPage() {
  const cards = [
    {
      href: "/buddy",
      emoji: "👥",
      title: "Buddy Trips",
      desc: "Travel with friends",
    },
    {
      href: null,
      emoji: "💬",
      title: "Rovvy Lounge",
      desc: "Messages, calls & updates",
    },
    {
      href: "/live",
      emoji: "📍",
      title: "Live Coordination",
      desc: "Real-time session",
    },
  ];

  return (
    <div className="min-h-[calc(100dvh-80px)] bg-[#F8FAFC] px-4 py-8 text-slate-800 md:px-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Your Group
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-500">
          Buddy trips, group hub, and live coordination.
        </p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => {
            const cardClass =
              "group flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#0F766E]/50 hover:bg-slate-50";
            const inner = (
              <>
                <span className="text-3xl" aria-hidden>
                  {c.emoji}
                </span>
                <span className="mt-3 text-lg font-semibold text-slate-900 group-hover:text-[#0F766E]">
                  {c.title}
                </span>
                <span className="mt-1 text-sm text-slate-500">{c.desc}</span>
                <span className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#0F766E]">
                  Open →
                </span>
              </>
            );
            return (
              <li key={c.href ?? c.title}>
                {c.href ? (
                  <Link href={c.href} className={cardClass}>
                    {inner}
                  </Link>
                ) : (
                  <OpenLoungeButton className={cardClass}>{inner}</OpenLoungeButton>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
