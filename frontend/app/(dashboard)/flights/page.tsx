"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Database, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        description="Search airline offers, understand routes, compare available options, and continue to the provider you choose. Rovvy does not sell or issue tickets."
        actions={
          <Link href="/flights/providers">
            <Button variant="secondary" size="sm"><Database className="h-4 w-4" /> Provider directory</Button>
          </Link>
        }
      />

      {handoff ? <TravelHandoffBanner handoff={handoff} /> : null}

      <FlightSearchForm handoff={handoff} initial={initial} />

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { title: "Provider inventory", body: "Compare available fares from authorized airline and travel providers." },
          { title: "Transparent pricing", body: "Review full fare details before you choose a provider." },
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
        Compare available airline offers · Authorized provider fares · Complete booking with the seller you choose
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
