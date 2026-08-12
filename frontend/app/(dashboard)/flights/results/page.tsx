"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plane, Search, LogIn, X, RefreshCw } from "lucide-react";
import Link from "next/link";
import { API_BASE, apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { parseFlightSearchParams } from "@/lib/flight-search-params";
import { searchFlightJourneys } from "@/lib/flight-journey-api";
import type { FlightJourney, FlightOfferDetail, FlightSortMode } from "@/lib/flight-types";
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
import FlightSearchForm from "@/components/travel/FlightSearchForm";
import FlightTrustStrip from "@/components/travel/FlightTrustStrip";
import FlightResultsToolbar from "@/components/travel/FlightResultsToolbar";
import FlightMobileFiltersDrawer from "@/components/travel/FlightMobileFiltersDrawer";
import { authHref } from "@/lib/auth-return";

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

function AuthRequiredModal({ onClose, returnPath }: { onClose: () => void; returnPath: string }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const loginHref = authHref("/login", returnPath);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <div className="relative w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Close sign-in prompt">
          <X className="h-5 w-5" />
        </button>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
          <Plane className="h-6 w-6" />
        </div>
        <div>
          <h3 id="auth-modal-title" className="text-lg font-bold text-slate-900">Sign in to book this flight</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Guests can search and review live fares. Sign in when you are ready to book securely inside Rovvy.
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Link href={loginHref} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white hover:bg-teal-700">
            <LogIn className="h-4 w-4" />
            Log in to continue
          </Link>
          <Link href={authHref("/register", returnPath)} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
            Create free account
          </Link>
        </div>
      </div>
    </div>
  );
}

function FlightResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const criteria = useMemo(() => parseFlightSearchParams(searchParams), [searchParams]);
  const isGuest = !getToken();

  const [rows, setRows] = useState<FlightJourney[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
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
  const [showEdit, setShowEdit] = useState(searchParams.get("edit") === "1");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingOfferPath, setPendingOfferPath] = useState<string | null>(null);
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
      setSearchMessage(data.message);
    } catch (e) {
      setRows([]);
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

  const selectOffer = (row: FlightJourney) => {
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
      setErrorBanner("This offer has expired. Search again for live fares.");
      return;
    }
    const qs = new URLSearchParams({ searchPrice: String(row.price) });
    if (criteria) {
      qs.set("from", criteria.from);
      qs.set("to", criteria.to);
      qs.set("depart", criteria.depart);
      if (criteria.return) qs.set("return", criteria.return);
    }
    if (isGuest && typeof window !== "undefined") {
      qs.set("restored", "1");
      qs.set("searchReturn", `${window.location.pathname}${window.location.search}`);
    }
    const path = `/flights/offer/${encodeURIComponent(row.id)}?${qs.toString()}`;
    if (isGuest) {
      setPendingOfferPath(path);
      setShowAuthModal(true);
      return;
    }
    router.push(path);
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
      <FlightTrustStrip />

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

      {showEdit ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <FlightSearchForm initial={criteria} compact />
          <button type="button" onClick={() => setShowEdit(false)} className="mt-4 text-sm font-bold text-slate-600 hover:text-slate-900">
            Cancel edit
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <aside className="hidden lg:block lg:w-72 lg:shrink-0">
          <div className="sticky top-24">
            <FlightFilterPanel
              filters={filters}
              airlines={airlineOptions}
              maxPrice={maxPrice}
              maxDuration={maxDuration}
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

          {!loading ? (
            <p className="px-1 text-sm text-slate-600">
              {sorted.length} live {sorted.length === 1 ? "fare" : "fares"} for your search
              {filteredOutCount > 0 ? ` · ${filteredOutCount} hidden by filters` : ""}
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

          {!loading && searchMessage && sorted.length === 0 && !errorBanner ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {searchMessage}
            </div>
          ) : null}

          {!loading && sorted.length === 0 && !errorBanner ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <Plane className="h-7 w-7 text-slate-400" />
              </div>
              <p className="mt-4 text-base font-bold text-slate-900">
                {filteredOutCount > 0 ? "No flights match your filters" : "No flights found"}
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
                {filteredOutCount > 0
                  ? "Try clearing filters or adjusting your departure time window."
                  : "Try different dates or adjust your advanced options."}
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
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700"
                >
                  <Search className="h-4 w-4" />
                  Edit search
                </button>
              </div>
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
                  onSelect={() => selectOffer(row)}
                  onDetails={() => void openDetails(row.id)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

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

      {showAuthModal && pendingOfferPath ? (
        <AuthRequiredModal onClose={() => setShowAuthModal(false)} returnPath={pendingOfferPath} />
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
