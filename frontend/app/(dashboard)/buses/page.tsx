"use client";

import Link from "next/link";

export default function BusesComingSoonPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center bg-[#0F172A] px-4 py-16 text-center text-[#F8FAFC]">
      <span className="text-5xl" aria-hidden>
        🚌
      </span>
      <h1 className="mt-6 text-2xl font-bold tracking-tight md:text-3xl">
        Buses — coming soon
      </h1>
      <p className="mt-3 max-w-md text-sm text-[#94A3B8]">
        Intercity bus search and booking will land here. Meanwhile, plan flights,
        hotels, and routes from the Plan hub.
      </p>
      <Link
        href="/plan"
        className="mt-8 rounded-xl bg-[#0F766E] px-5 py-3 text-sm font-semibold text-[#F8FAFC] transition hover:bg-[#115E59]"
      >
        Back to Plan
      </Link>
    </div>
  );
}
