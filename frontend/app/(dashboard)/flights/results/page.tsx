"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plane, Search, RefreshCw, X } from "lucide-react";
import { API_BASE, apiFetch } from "@/lib/api";
import { parseFlightSearchParams } from "@/lib/flight-search-params";
import { searchFlightJourneys } from "@/lib/flight-journey-api";
import type {
  FlightJourney,
  FlightRouteRecoveryOption,
  FlightOfferDetail,
  FlightSortMode,
  ProviderEnvironment,
  ProviderStatusRecord,
  RovvyItineraryGroup,
} from "@/lib/flight-types";
import {
  countActiveFilters,
  createDefaultFilters,
  filterFlights,
  formatDuration,
  formatPrice,
  sortFlights,
  uniqueAirlines,
} from "@/lib/flight-format";
import FlightSearchSummary from "@/components/travel/FlightSearchSummary";
import FlightSortTabs from "@/components/travel/FlightSortTabs";
import FlightFilterPanel from "@/components/travel/FlightFilterPanel";
import FlightOfferCard from "@/components/travel/FlightOfferCard";
import FlightDetailsDrawer from "@/components/travel/FlightDetailsDrawer";
import FlightOptionsDrawer from "@/components/travel/FlightOptionsDrawer";
import FlightTrustStrip from "@/components/travel/FlightTrustStrip";
import FlightResultsToolbar from "@/components/travel/FlightResultsToolbar";
import FlightMobileFiltersDrawer from "@/components/travel/FlightMobileFiltersDrawer";

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-slate-200" />
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="h-4 w-40 rounded bg-slate-200" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-1 md:gap-3">
          <div className="h-16 rounded-xl bg-slate-100" />
          <div className="h-16 rounded-xl bg-slate-100" />
        </div>
        <div className="space-y-2 xl:w-48">
          <div className="h-3 w-20 rounded bg-slate-200" />
          <div className="h-8 w-28 rounded bg-slate-200" />
          <div className="h-10 rounded-xl bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

function findItineraryGroup(groups: RovvyItineraryGroup[], row: FlightJourney): RovvyItineraryGroup | null {
  if (!groups.length) return null;
  for (const g of groups) {
    if (g.seller_options.some((opt) => opt.provider_offer_id === row.id || opt.provider_offer_id === row.provider_offer_id)) {
      return g;
    }
  }
  return null;
}

function FlightResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const criteria = useMemo(() => parseFlightSearchParams(searchParams), [searchParams]);

  const [rows, setRows] = useState<FlightJourney[]>([]);
  const [itineraryGroups, setItineraryGroups] = useState<RovvyItineraryGroup[]>([]);
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatusRecord[]>([]);
  const [partialResults, setPartialResults] = useState(false);
  const [searchEnvironment, setSearchEnvironment] = useState<ProviderEnvironment | null>("test");
  const [searchLiveMode, setSearchLiveMode] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [routeRecovery, setRouteRecovery] = useState<FlightRouteRecoveryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<FlightSortMode>("best");
  const [filters, setFilters] = useState(() =>
    createDefaultFilters({
      nonstopOnly: criteria?.nonstop ?? false,
      maxStops: criteria?.nonstop ? 0 : null,
    }),
  );
  const [draftFilters, setDraftFilters] = useState(filters);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [detailsOffer, setDetailsOffer] = useState<FlightOfferDetail | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [optionsGroup, setOptionsGroup] = useState<RovvyItineraryGroup | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const travelerCount = criteria ? criteria.adults + criteria.children + criteria.infants : 1;

  const runSearch = useCallback(async () => {
    if (!criteria) return;
    setLoading(true);
    setErrorBanner(null);
    setSearchMessage(null);
    try {
      const data = await searchFlightJourneys(criteria);
      setRows(Array.isArray(data.journeys) ? data.journeys : []);
      setItineraryGroups(Array.isArray(data.itinerary_groups) ? data.itinerary_groups : []);
      setProviderStatuses(Array.isArray(data.provider_statuses) ? data.provider_statuses : []);
      setPartialResults(Boolean(data.partial_results));
      setSearchEnvironment(data.environment || (data.live_mode ? "live" : "test"));
      setSearchLiveMode(Boolean(data.live_mode));
      setSearchMessage(data.message);
      setRouteRecovery(Array.isArray(data.route_recovery) ? data.route_recovery : []);
    } catch (e) {
      setRows([]);
      setItineraryGroups([]);
      setProviderStatuses([]);
      setRouteRecovery([]);
      const hint = e instanceof Error ? e.message : String(e);
      const unavailable = hint.toLowerCase().includes("unavailable") || hint.toLowerCase().includes("not configured");
      setErrorBanner(
        unavailable
          ? "Live flight search is temporarily unavailable. Rovvy does not show estimated alternatives."
          : process.env.NODE_ENV === "development"
            ? `Flight search failed.\n${hint}\nAPI: ${API_BASE}`
            : "Flight search is unavailable right now.",
      );
    } finally {
      setLoading(false);
    }
  }, [criteria]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  useEffect(() => {
    if (!criteria) return;
    const next = createDefaultFilters({
      nonstopOnly: criteria.nonstop ?? false,
      maxStops: criteria.nonstop ? 0 : null,
    });
    setFilters(next);
    setDraftFilters(next);
  }, [criteria]);

  const maxPrice = useMemo(() => Math.max(...rows.map((row) => row.price), 500), [rows]);
  const maxDuration = useMemo(
    () => Math.max(...rows.map((row) => row.total_duration_minutes || row.duration_minutes), 600),
    [rows],
  );
  const filtered = useMemo(() => filterFlights(rows, filters) as FlightJourney[], [rows, filters]);
  const sorted = useMemo(() => sortFlights(filtered, sortMode) as FlightJourney[], [filtered, sortMode]);
  const airlineOptions = useMemo(() => uniqueAirlines(rows), [rows]);
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const minPriceNonstop = useMemo(() => {
    const nonstops = rows.filter((row) => row.stops === 0);
    return nonstops.length > 0 ? Math.min(...nonstops.map((row) => row.price)) : null;
  }, [rows]);

  const minPriceOneStop = useMemo(() => {
    const oneStops = rows.filter((row) => row.stops === 1);
    return oneStops.length > 0 ? Math.min(...oneStops.map((row) => row.price)) : null;
  }, [rows]);

  const cheapestPriceLabel = useMemo(() => {
    if (rows.length === 0) return null;
    return formatPrice(rows[0]?.currency || "USD", Math.min(...rows.map((row) => row.price)));
  }, [rows]);

  const fastestDurationLabel = useMemo(() => {
    if (rows.length === 0) return null;
    return formatDuration(Math.min(...rows.map((row) => row.total_duration_minutes || row.duration_minutes)));
  }, [rows]);

  const filteredOutCount = rows.length - filtered.length;
  const currency = rows[0]?.currency || "USD";
  const travelpayoutsStatus = providerStatuses.find(
    (status) => status.provider_id === "travelpayouts",
  );
  const travelpayoutsEmpty =
    rows.length === 0 &&
    travelpayoutsStatus?.status === "ok" &&
    travelpayoutsStatus.offer_count === 0;

  const openDetails = async (offerId: string) => {
    setDetailsId(offerId);
    setDetailsLoading(true);
    setDetailsOffer(null);
    try {
      const detail = await apiFetch<FlightOfferDetail>(`/flights/offers/${encodeURIComponent(offerId)}`);
      setDetailsOffer(detail);
    } catch {
      setDetailsOffer(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const tryRecoveredRoute = (option: FlightRouteRecoveryOption) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("from", option.origin);
    next.set("to", option.destination);
    next.set("fromLabel", option.origin);
    next.set("toLabel", option.destination);
    next.set("depart", option.departure_date);
    router.push(`/flights/results?${next.toString()}`);
  };

  const openOptions = (row: FlightJourney) => {
    const group = findItineraryGroup(itineraryGroups, row);
    if (group) {
      setOptionsGroup(group);
      return;
    }
    setOptionsGroup({
      itinerary_key: row.id,
      marketing_airlines: row.airlines,
      operating_airlines: row.airlines,
      slices: row.slices,
      total_duration_minutes: row.total_duration_minutes || row.duration_minutes,
      stops: row.stops,
      departure_at: row.departure_at,
      arrival_at: row.arrival_at,
      origin: row.origin,
      destination: row.destination,
      lowest_price: row.price,
      currency: row.currency,
      seller_options: [
        {
          provider_id: row.provider,
          provider_offer_id: row.provider_offer_id,
          seller_id: row.provider,
          seller_name: row.live_mode ? "Duffel" : "Duffel sandbox",
          total_price: row.price,
          currency: row.currency,
          baggage: {
            carry_on_included: row.carry_on_included,
            checked_bag_included: row.checked_bag_included,
            summary:
              row.carry_on_included || row.checked_bag_included
                ? [
                    row.carry_on_included ? "Carry-on included" : null,
                    row.checked_bag_included ? "Checked bag included" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "Not confirmed",
          },
          fare_conditions: {
            refundable: row.refundable,
            changeable: row.changeable,
            summary:
              row.changeable || row.refundable
                ? [
                    row.changeable ? "Changeable" : null,
                    row.refundable ? "Refundable" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "Not confirmed",
          },
          protected_connection: row.protected_connection,
          separate_tickets: null,
          self_transfer: null,
          redirect_url: row.deep_link || null,
          action_type: row.deep_link ? "external_redirect" : "unavailable",
          checked_at: row.checked_at,
          expires_at: row.expires_at || null,
          last_ticketing_date: row.last_ticketing_date ?? null,
          environment: row.live_mode ? "live" : "test",
        },
      ],
    });
  };

  if (!criteria) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-8 text-center">
        <p className="text-sm font-bold text-rose-800">Missing search criteria.</p>
        <button type="button" className="mt-3 text-sm font-bold text-rose-700 underline" onClick={() => router.push("/flights")}>
          Start a new search
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FlightSearchSummary params={criteria} resultCount={sorted.length} loading={loading} />
      <FlightTrustStrip
        environment={searchEnvironment}
        liveMode={searchLiveMode}
        providerStatuses={providerStatuses}
        partialResults={partialResults}
      />

      <FlightResultsToolbar
        sortMode={sortMode}
        activeFilterCount={activeFilterCount}
        resultCount={sorted.length}
        onOpenFilters={() => {
          setDraftFilters(filters);
          setMobileFiltersOpen(true);
        }}
        onOpenSort={() => setMobileSortOpen(true)}
      />

      <div className="flex gap-6">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-24">
            <FlightFilterPanel
              filters={filters}
              airlines={airlineOptions}
              maxPrice={maxPrice}
              maxDuration={maxDuration}
              resultCount={sorted.length}
              filteredOutCount={filteredOutCount}
              journeys={rows}
              minPriceNonstop={minPriceNonstop}
              minPriceOneStop={minPriceOneStop}
              currency={currency}
              onChange={setFilters}
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="hidden rounded-xl border border-slate-200 bg-white px-4 py-3 lg:block">
            <FlightSortTabs
              value={sortMode}
              onChange={setSortMode}
              cheapestPrice={cheapestPriceLabel}
              fastestDuration={fastestDurationLabel}
            />
          </div>

          {searchMessage && sorted.length > 0 ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
              {searchMessage}
            </p>
          ) : null}

          {errorBanner ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800" role="alert">
              <p className="whitespace-pre-wrap font-medium">{errorBanner}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void runSearch()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white">
                  <RefreshCw className="h-4 w-4" />
                  Retry search
                </button>
                <button type="button" onClick={() => router.push("/flights")} className="inline-flex min-h-11 items-center rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-800">
                  Edit search
                </button>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : null}

          {!loading && sorted.length === 0 && !errorBanner ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <Plane className="h-7 w-7 text-slate-400" />
              </div>
              <p className="mt-4 text-base font-bold text-slate-900">
                {filteredOutCount > 0
                  ? "No flights match your filters"
                  : travelpayoutsEmpty
                    ? "No cached Aviasales fares for this search"
                    : "No flights found"}
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
                {filteredOutCount > 0
                  ? "Try clearing filters or adjusting your departure time window."
                  : travelpayoutsEmpty
                    ? "Travelpayouts responded successfully, but Aviasales did not return a cached fare for this route and date. Try a major nearby airport or different dates."
                    : searchMessage || "Try different dates or adjust your advanced options."}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {filteredOutCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setFilters(createDefaultFilters())}
                    className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
                  >
                    Clear filters
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => router.push("/flights")}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-hover"
                >
                  <Search className="h-4 w-4" />
                  Edit search
                </button>
              </div>
              {routeRecovery.length > 0 && filteredOutCount === 0 ? (
                <div className="mx-auto mt-8 max-w-3xl border-t border-slate-200 pt-6 text-left">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-base font-extrabold text-slate-950">Other ways to search this journey</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        These are alternate searches, not confirmed itineraries. Rovvy shows a price only after an authorized provider returns one.
                      </p>
                    </div>
                    <span className="mt-2 text-xs font-bold uppercase tracking-wide text-primary sm:mt-0">Route recovery</span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {routeRecovery.map((option) => (
                      <button
                        key={`${option.tier}-${option.origin}-${option.destination}`}
                        type="button"
                        onClick={() => tryRecoveredRoute(option)}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-teal-400 hover:bg-primary-soft focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-extrabold text-slate-950">{option.title}</p>
                            <p className="mt-1 text-lg font-black text-primary">{option.origin} → {option.destination}</p>
                          </div>
                          <Search className="mt-1 h-4 w-4 shrink-0 text-primary" />
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-600">{option.explanation}</p>
                        {option.separate_searches_required ? (
                          <p className="mt-2 text-xs font-bold text-amber-700">Separate tickets or ground travel may be required.</p>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {!loading && sorted.length > 0 ? (
            <div className="space-y-3">
              {sorted.map((row) => (
                <FlightOfferCard
                  key={row.id}
                  journey={row}
                  sortedJourneys={sorted}
                  sortMode={sortMode}
                  roundTrip={Boolean(criteria.return || criteria.tripType === "roundtrip")}
                  travelerCount={travelerCount}
                  onSelect={() => openOptions(row)}
                  onDetails={() => void openDetails(row.id)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {optionsGroup ? (
        <FlightOptionsDrawer group={optionsGroup} onClose={() => setOptionsGroup(null)} />
      ) : null}

      {detailsId ? (
        <FlightDetailsDrawer
          offer={detailsOffer}
          loading={detailsLoading}
          onClose={() => {
            setDetailsId(null);
            setDetailsOffer(null);
          }}
        />
      ) : null}

      <FlightMobileFiltersDrawer
        open={mobileFiltersOpen}
        title="Filter flights"
        filters={filters}
        draftFilters={draftFilters}
        airlines={airlineOptions}
        maxPrice={maxPrice}
        minPriceNonstop={minPriceNonstop}
        minPriceOneStop={minPriceOneStop}
        currency={currency}
        maxDuration={maxDuration}
        journeys={rows}
        resultCount={filterFlights(rows, draftFilters).length}
        onChangeDraft={setDraftFilters}
        onApply={() => {
          setFilters(draftFilters);
          setMobileFiltersOpen(false);
        }}
        onReset={() => setDraftFilters(createDefaultFilters())}
        onClose={() => setMobileFiltersOpen(false)}
      />

      {mobileSortOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm lg:hidden" role="dialog" aria-modal="true" aria-label="Sort flights">
          <button type="button" aria-label="Close sort menu" className="absolute inset-0" onClick={() => setMobileSortOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-bold text-slate-900">Sort flights</p>
              <button type="button" onClick={() => setMobileSortOpen(false)} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <FlightSortTabs
              value={sortMode}
              onChange={(mode) => {
                setSortMode(mode);
                setMobileSortOpen(false);
              }}
              cheapestPrice={cheapestPriceLabel}
              fastestDuration={fastestDurationLabel}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function FlightResultsPage() {
  return (
    <div className="min-h-[calc(100vh-120px)] bg-app px-4 py-6 md:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <Suspense
          fallback={
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="space-y-3 text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600" />
                <p className="text-sm font-medium text-slate-500">Loading results…</p>
              </div>
            </div>
          }
        >
          <FlightResultsContent />
        </Suspense>
      </div>
    </div>
  );
}
