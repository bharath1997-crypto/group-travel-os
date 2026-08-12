"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import TravelHandoffBanner from "@/components/travel/TravelHandoffBanner";
import FlightSearchForm from "@/components/travel/FlightSearchForm";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { parseFlightSearchParams } from "@/lib/flight-search-params";
import { parseTravelHandoff } from "@/lib/travel-handoff";

function FlightsPageContent() {
  const searchParams = useSearchParams();
  const handoff = useMemo(() => parseTravelHandoff(searchParams), [searchParams]);
  const initial = useMemo(() => parseFlightSearchParams(searchParams), [searchParams]);

  return (
    <PageShell wide className="space-y-8">
      <PageHeader
        title="Flights"
        description="Search live airline fares, compare options, and complete your booking without leaving Rovvy."
      />

      {handoff ? <TravelHandoffBanner handoff={handoff} /> : null}

      <FlightSearchForm handoff={handoff} initial={initial} />

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { title: "Live inventory", body: "Fares pulled from airline systems in real time." },
          { title: "Transparent pricing", body: "Review full fare details before you pay." },
          { title: "Group-ready", body: "Attach confirmed flights to your Trip Space." },
        ].map((item) => (
          <Card key={item.title} padding="sm" className="shadow-sm">
            <p className="text-sm font-semibold text-text">{item.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{item.body}</p>
          </Card>
        ))}
      </section>

      <p className="flex items-center gap-2 text-xs text-muted">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        Secure checkout · Live airline fares · Book entirely inside Rovvy
      </p>
    </PageShell>
  );
}

export default function FlightsPage() {
  return (
    <div className="min-h-[calc(100vh-120px)] rounded-card border border-border bg-app p-4 md:p-6 lg:p-8">
      <Suspense
        fallback={
          <div className="flex min-h-[50vh] items-center justify-center text-sm font-medium text-muted">
            Loading flights…
          </div>
        }
      >
        <FlightsPageContent />
      </Suspense>
    </div>
  );
}
