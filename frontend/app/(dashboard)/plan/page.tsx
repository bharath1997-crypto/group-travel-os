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
      desc: "Coming soon",
      badge: true,
    },
  ];

  return (
    <div className="min-h-[calc(100dvh-80px)] bg-[#0F172A] px-4 py-8 text-[#F8FAFC] md:px-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Plan Your Trip
        </h1>
        <p className="mt-2 max-w-xl text-sm text-[#94A3B8]">
          Flights, stays, and how you move — start here.
        </p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                className="group relative flex h-full flex-col rounded-2xl border border-[#1E293B] bg-[#1E293B] p-5 shadow-lg transition hover:border-[#0F766E]/50 hover:bg-[#263548]"
              >
                {c.badge ? (
                  <span className="absolute right-3 top-3 rounded-full bg-[#115E59]/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#CCFBF1]">
                    Soon
                  </span>
                ) : null}
                <span className="text-3xl" aria-hidden>
                  {c.emoji}
                </span>
                <span className="mt-3 text-lg font-semibold group-hover:text-[#CCFBF1]">
                  {c.title}
                </span>
                <span className="mt-1 text-sm text-[#94A3B8]">{c.desc}</span>
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
