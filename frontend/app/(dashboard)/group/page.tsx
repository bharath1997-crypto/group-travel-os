"use client";

import Link from "next/link";

export default function GroupHubPage() {
  const cards = [
    {
      href: "/buddy",
      emoji: "👥",
      title: "Buddy Trips",
      desc: "Travel with friends",
    },
    {
      href: "/travel-hub",
      emoji: "💬",
      title: "Travel Hub",
      desc: "Groups & coordination",
    },
    {
      href: "/live",
      emoji: "📍",
      title: "Live Coordination",
      desc: "Real-time session",
    },
  ];

  return (
    <div className="min-h-[calc(100dvh-80px)] bg-[#0F172A] px-4 py-8 text-[#F8FAFC] md:px-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Your Group
        </h1>
        <p className="mt-2 max-w-xl text-sm text-[#94A3B8]">
          Buddy trips, group hub, and live coordination.
        </p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                className="group flex h-full flex-col rounded-2xl border border-[#1E293B] bg-[#1E293B] p-5 shadow-lg transition hover:border-[#0F766E]/50 hover:bg-[#263548]"
              >
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
