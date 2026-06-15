"use client";

import Link from "next/link";

export default function PlanHubPage() {
  const cards = [
    { href: "/flights", emoji: "✈️", title: "Flights", desc: "Search fares & routes" },
    { href: "/hotels", emoji: "🏨", title: "Hotels", desc: "Stays & nightly rates" },
    { href: "/routes", emoji: "🗺️", title: "Routes", desc: "Flights + ground options" },
    {
      href: "/buses",
      emoji: "🚌",
      title: "Buses",
      desc: "Bus routes & fares",
    },
    {
      href: "/trip-space",
      emoji: "🏕️",
      title: "Trip Space",
      desc: "Plan weekend trips",
    },
  ];

  return (
    <div className="min-h-[calc(100dvh-80px)] bg-[#F8FAFC] px-4 py-8 text-slate-800 md:px-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Plan Your Trip
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-500">
          Flights, stays, and how you move — start here.
        </p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                className="group relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#0F766E]/50 hover:bg-slate-50"
              >
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
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
