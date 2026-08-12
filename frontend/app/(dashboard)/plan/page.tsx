"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import TravelHandoffBanner from "@/components/travel/TravelHandoffBanner";
import { buildTravelHandoffPath, parseTravelHandoff } from "@/lib/travel-handoff";

function PlanHubContent() {
  const searchParams = useSearchParams();
  const handoff = useMemo(() => parseTravelHandoff(searchParams), [searchParams]);

  const cards = [
    { href: "/flights", emoji: "✈️", title: "Flights", desc: "Search fares & routes" },
    { href: "/hotels", emoji: "🏨", title: "Hotels", desc: "Stays & nightly rates" },
    { href: "/routes", emoji: "🗺️", title: "Routes", desc: "Flights + ground options" },
    { href: "/buses", emoji: "🚌", title: "Buses", desc: "Bus routes & fares" },
    { href: "/trip-space", emoji: "🏕️", title: "Trip Space", desc: "Plan weekend trips" },
  ];

  return (
    <div className="min-h-[calc(100dvh-80px)] bg-app px-4 py-8 text-slate-800 md:px-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Plan Your Trip
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-500">
          Flights, stays, and how you move — start here.
        </p>

        {handoff ? (
          <div className="mt-6">
            <TravelHandoffBanner handoff={handoff} />
          </div>
        ) : null}

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => {
            const href =
              handoff && (c.href === "/flights" || c.href === "/routes" || c.href === "/buses")
                ? buildTravelHandoffPath(
                    c.href.slice(1) as "flights" | "routes" | "buses",
                    {
                      name: handoff.destination.name,
                      city: handoff.destination.city,
                      state: handoff.destination.state,
                      country: handoff.destination.country,
                      lat: handoff.destination.lat ?? 0,
                      lng: handoff.destination.lng ?? 0,
                    },
                    {
                      name: handoff.origin.name,
                      country: handoff.origin.country,
                      lat: handoff.origin.lat,
                      lng: handoff.origin.lng,
                    },
                  )
                : c.href;
            return (
              <li key={c.href}>
                <Link
                  href={href}
                  className="group relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary/50 hover:bg-slate-50"
                >
                  <span className="text-3xl" aria-hidden>
                    {c.emoji}
                  </span>
                  <span className="mt-3 text-lg font-semibold text-slate-900 group-hover:text-primary">
                    {c.title}
                  </span>
                  <span className="mt-1 text-sm text-slate-500">{c.desc}</span>
                  <span className="mt-4 text-xs font-semibold uppercase tracking-wide text-primary">
                    Open →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default function PlanHubPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100dvh-80px)] bg-app px-8 flex items-center justify-center text-slate-500">
          Loading plan hub…
        </div>
      }
    >
      <PlanHubContent />
    </Suspense>
  );
}
