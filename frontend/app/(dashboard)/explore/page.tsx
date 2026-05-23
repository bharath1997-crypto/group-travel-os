"use client";

import Link from "next/link";

/**
 * Explore hub — primary tab destination /explore.
 * Events / weather live on /explore/events (legacy full explorer UI).
 */
export default function ExploreHubPage() {
  const cards = [
    {
      href: "/activities",
      emoji: "🎯",
      title: "Activities",
      desc: "Tours, sights & experiences",
    },
    {
      href: "/explore/events",
      emoji: "📅",
      title: "Events",
      desc: "City feeds, media & discovery",
    },
    {
      href: "/weather",
      emoji: "🌤️",
      title: "Weather",
      desc: "Forecasts for your trip",
    },
    {
      href: "/map",
      emoji: "🗺️",
      title: "Interactive Map",
      desc: "Pins, routes, weather & local events",
    },
  ];

  return (
    <div className="min-h-[calc(100dvh-80px)] bg-[#0F172A] px-4 py-8 text-[#F8FAFC] md:px-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight text-[#F8FAFC] md:text-3xl">
          Explore
        </h1>
        <p className="mt-2 max-w-xl text-sm text-[#94A3B8]">
          Activities, events, and weather — pick where to dive in.
        </p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                className="group flex h-full flex-col rounded-2xl border border-[#1E293B] bg-[#1E293B] p-5 shadow-lg transition hover:border-[#0F766E]/50 hover:bg-[#263548]"
              >
                <span className="text-3xl" aria-hidden>
                  {c.emoji}
                </span>
                <span className="mt-3 text-lg font-semibold text-[#F8FAFC] group-hover:text-[#CCFBF1]">
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
