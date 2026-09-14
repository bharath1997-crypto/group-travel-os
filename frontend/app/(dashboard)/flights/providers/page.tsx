"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Database, Info, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { FlightProviderDirectoryResponse, getFlightProviderDirectory } from "@/lib/flight-provider-directory";

const PAGE_SIZE = 24;
const readable = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function FlightProvidersPage() {
  const [query, setQuery] = useState("");
  const [providerType, setProviderType] = useState("");
  const [passengerOnly, setPassengerOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<FlightProviderDirectoryResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setError("");
      getFlightProviderDirectory({ query, providerType, passengerOnly, page, pageSize: PAGE_SIZE })
        .then(setData)
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Provider directory is unavailable."));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query, providerType, passengerOnly, page]);

  const pages = useMemo(() => Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE)), [data]);

  return (
    <PageShell wide className="space-y-6">
      <PageHeader
        title="Flight provider directory"
        description="Explore airlines and travel-technology organizations tracked by Rovvy. Directory inclusion does not mean a live API connection or commercial partnership."
        breadcrumbs={[{ label: "Flights", href: "/flights" }, { label: "Provider directory" }]}
        actions={<Link href="/flights"><Button variant="secondary" size="sm"><ArrowLeft className="h-4 w-4" /> Back to search</Button></Link>}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <Card padding="sm"><p className="text-2xl font-bold text-text">{data?.total ?? "—"}</p><p className="text-xs text-muted">Matching organizations</p></Card>
        <Card padding="sm"><p className="text-2xl font-bold text-text">{data?.connected_sources ?? "—"}</p><p className="text-xs text-muted">Connected search sources</p></Card>
        <Card padding="sm"><p className="text-2xl font-bold text-text">500</p><p className="text-xs text-muted">Organizations in the knowledge catalog</p></Card>
      </section>

      <Card className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_280px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search providers" className="h-10 w-full rounded-control border border-border bg-surface pl-9 pr-3 text-sm text-text outline-none focus:border-primary" />
          </label>
          <select value={providerType} onChange={(event) => { setProviderType(event.target.value); setPage(1); }} className="h-10 rounded-control border border-border bg-surface px-3 text-sm text-text">
            <option value="">All provider types</option>
            {(data?.provider_types ?? []).map((type) => <option key={type} value={type}>{readable(type)}</option>)}
          </select>
          <label className="flex h-10 items-center gap-2 rounded-control border border-border px-3 text-sm text-text">
            <input type="checkbox" checked={passengerOnly} onChange={(event) => { setPassengerOnly(event.target.checked); setPage(1); }} /> Passenger relevant
          </label>
        </div>
        <p className="flex items-start gap-2 rounded-control bg-primary/5 p-3 text-xs leading-relaxed text-muted"><Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />“Information only” means Rovvy tracks provider information but does not currently query that organization for live fares.</p>
      </Card>

      {error ? <Card className="border-error/30 bg-error/5 text-sm text-error">{error}</Card> : null}
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(data?.items ?? []).map((provider) => (
          <Card key={provider.catalog_id} padding="sm" className="flex min-h-40 flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary"><Database className="h-4 w-4" /></span>
                <div className="min-w-0"><h2 className="truncate text-sm font-semibold text-text">{provider.provider_name}</h2><p className="mt-0.5 text-xs text-muted">{readable(provider.provider_type)}</p></div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${provider.connectivity_status === "information_only" ? "bg-subtle text-muted" : "bg-success/10 text-success"}`}>{readable(provider.connectivity_status)}</span>
            </div>
            <p className="text-xs leading-relaxed text-muted">No live fare is shown unless Rovvy has an authorized, configured data connection.</p>
          </Card>
        ))}
      </section>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">Page {page} of {pages}</p>
        <div className="flex gap-2"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
      </div>
    </PageShell>
  );
}
