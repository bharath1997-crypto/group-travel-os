"use client";



import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";



import { useDashboardUser } from "@/contexts/dashboard-user-context";

import { ExploreAskCard } from "./components/ExploreAskCard";

import { ExploreDestinationsSection } from "./components/ExploreDestinationsSection";
import { ExploreLocationSearch } from "./components/ExploreLocationSearch";

import { ExploreDetailDrawer } from "./components/ExploreDetailDrawer";

import { ExploreFilterChip } from "./components/ExploreFilterChip";

import { ExploreHubCalendarStrip } from "./components/ExploreHubCalendarStrip";

import { ExploreRankingRow } from "./components/ExploreRankingRow";

import { ExploreSavedBar } from "./components/ExploreSavedBar";

import { ExploreSlotCard } from "./components/ExploreSlotCard";
import { useExploreHubSaves } from "./use-explore-hub-saves";

import { ExploreWayraPlanCard } from "./components/ExploreWayraPlanCard";

import { exploreCardReasonLabel } from "./explore-card-reason";
import { HeroLocationWidget } from "./HeroLocationWidget";

import {

  EXPLORE_CITY,

  EXPLORE_PROMPT_SUGGESTIONS,

  EXPLORE_VIBES,

  EXPLORE_WHEN_OPTIONS,

} from "./explore-fixtures";

import {

  buildMasonryFeed,

  filterHubSlotsByChips,

  hubSlotToCard,

  hubSlotToDetail,

  hubSlotsToRanking,

  slotsToWayraPlans,

  statsTuplesToExploreStats,

} from "./explore-hub-v6-map";

import {
  formatExploreHubFreshnessLine,
  formatExploreListingSources,
} from "./explore-freshness-copy";
import { formatPartialSourceFailureLine } from "./explore-hub-fetch-state";
import {
  EXPLORE_HUB_PAGE_SIZE,
  buildExploreCategoryStats,
  computeExploreHubCounts,
  formatExploreHubFeedSummary,
  formatLoadMoreButtonLabel,
  sliceVisibleListings,
} from "./explore-hub-counts";
import { deriveExploreHeroListingCountState } from "./explore-hero-listing-count";
import { useExploreHub } from "./use-explore-hub";

import {
  buildCalendarDaySummaries,
  filterSlotsByTimeScope,
  formatCalendarSelectedLabel,
} from "./explore-hub-time-scope";

import styles from "./explore.module.css";



const FILTER_GROUPS = [

  ["Kind", ["Music", "Food", "Comedy", "Outdoors", "Art"]],

  ["Price, all-in", ["Free", "Under $25", "$25–60", "$60+"]],

  ["Practical", ["Indoor"]],

] as const;



export default function ExplorePage() {

  const { user } = useDashboardUser();

  const searchParams = useSearchParams();

  const [when, setWhen] = useState("Tonight");

  const [calendarDayIso, setCalendarDayIso] = useState<string | null>(null);

  const {
    city,
    setCity,
    locationScope,
    applyLocationScope,
    clearLocationScope,
    loading,
    unexpectedError,
    data,
    retry,
  } = useExploreHub(when);

  const [pickedCityBanner, setPickedCityBanner] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("Saturday night, six of us, under $70");

  const promptRef = useRef<HTMLTextAreaElement>(null);

  const syncPromptHeight = useCallback(() => {

    const field = promptRef.current;

    if (!field) return;

    field.style.height = "auto";

    field.style.height = `${Math.min(field.scrollHeight, 116)}px`;

  }, []);



  useEffect(() => {

    syncPromptHeight();

  }, [prompt, syncPromptHeight]);

  const [filtersOpen, setFiltersOpen] = useState(false);

  const [answered, setAnswered] = useState(false);

  const [chips, setChips] = useState<string[]>([]);

  const [detailId, setDetailId] = useState<string | null>(null);

  const [visibleLimit, setVisibleLimit] = useState(EXPLORE_HUB_PAGE_SIZE);

  useEffect(() => {

    const fromQuery = searchParams.get("city")?.trim();
    const countryQuery = searchParams.get("country")?.trim();

    if (!fromQuery && !countryQuery) return;

    const label = [fromQuery, countryQuery].filter(Boolean).join(", ");
    applyLocationScope({
      label,
      city: fromQuery || undefined,
      fetchCity: fromQuery || undefined,
      country: countryQuery || undefined,
    });

    setPickedCityBanner(label);

  }, [searchParams, applyLocationScope]);

  const displayCity = data?.displayCity || locationScope?.label || city;

  const hubSaves = useExploreHubSaves(displayCity);

  const hubLoadState = data?.hubLoadState;
  const loadedScopeSlots = useMemo(() => {
    if (loading || !data) return [];
    const savedPlaceSlots = data.slots.filter(
      (s) => s.exploreListingKind === "place" && hubSaves.savedSlotIds.includes(s.id),
    );
    return data.slots.map((slot) => ({
      ...slot,
      reason:
        exploreCardReasonLabel(slot, {
          when,
          savedPlaceSlots,
          anchorLat: data.placesAnchor?.lat ?? locationScope?.lat,
          anchorLon: data.placesAnchor?.lng ?? locationScope?.lon,
        }) ?? slot.reason,
    }));
  }, [loading, data, when, hubSaves.savedSlotIds, locationScope?.lat, locationScope?.lon]);
  const timeScopedSlots = useMemo(
    () => filterSlotsByTimeScope(loadedScopeSlots, when, calendarDayIso),
    [loadedScopeSlots, when, calendarDayIso],
  );
  const showInventorySections = timeScopedSlots.length > 0;
  const calendarDays = useMemo(
    () => buildCalendarDaySummaries(loadedScopeSlots, when),
    [loadedScopeSlots, when],
  );
  const hubPartial = !loading && data?.hubLoadState === "partial";

  const paginationResetKey = `${city}|${locationScope?.label ?? ""}|${when}|${calendarDayIso ?? ""}|${chips.join("\u0000")}|${data?.loadedAt ?? ""}`;
  useEffect(() => {
    setVisibleLimit(EXPLORE_HUB_PAGE_SIZE);
  }, [paginationResetKey]);

  const matchingSlots = useMemo(
    () => filterHubSlotsByChips(timeScopedSlots, chips, when, calendarDayIso),
    [timeScopedSlots, chips, when, calendarDayIso],
  );

  const filtersActive = chips.length > 0;
  const zeroFilterMatch = filtersActive && matchingSlots.length === 0;
  const visibleSlots = useMemo(
    () => sliceVisibleListings(matchingSlots, visibleLimit),
    [matchingSlots, visibleLimit],
  );

  const hubCounts = useMemo(
    () => computeExploreHubCounts(timeScopedSlots, matchingSlots, visibleLimit),
    [timeScopedSlots, matchingSlots, visibleLimit],
  );

  const slotById = useMemo(
    () => new Map(timeScopedSlots.map((slot) => [slot.id, slot])),
    [timeScopedSlots],
  );

  const allSlotsById = useMemo(
    () => new Map(loadedScopeSlots.map((slot) => [slot.id, slot])),
    [loadedScopeSlots],
  );

  const stats = useMemo(
    () =>
      statsTuplesToExploreStats(
        buildExploreCategoryStats(timeScopedSlots, chips, when, calendarDayIso),
      ),
    [timeScopedSlots, chips, when, calendarDayIso],
  );

  const ranking = useMemo(() => hubSlotsToRanking(visibleSlots), [visibleSlots]);

  const masonryFeed = useMemo(() => {

    const cards = visibleSlots.map((slot, index) => hubSlotToCard(slot, index));

    return buildMasonryFeed(cards);

  }, [visibleSlots]);



  const wayraPlans = useMemo(

    () => (answered ? slotsToWayraPlans(visibleSlots, prompt) : []),

    [answered, visibleSlots, prompt],

  );



  const detail = useMemo(() => hubSlotToDetail(detailId ? slotById.get(detailId) : undefined), [detailId, slotById]);

  const chipCount = chips.length;

  const feedSummaryLine = formatExploreHubFeedSummary({
    city: displayCity,
    filtersActive,
    visibleCount: hubCounts.visibleCount,
    loadedScopeCount: hubCounts.loadedScopeCount,
    matchingCount: hubCounts.matchingCount,
  });

  const calendarScopeLine = calendarDayIso
    ? `Calendar: ${formatCalendarSelectedLabel(calendarDayIso)} (dated events + nearby places)`
    : null;

  const showLoadMore = showInventorySections && !zeroFilterMatch && hubCounts.hasMore;

  const listingSourcesLine = useMemo(
    () => formatExploreListingSources(data?.sources),
    [data?.sources],
  );

  const freshnessLine = useMemo(
    () => formatExploreHubFreshnessLine(data?.sourceFreshness ?? {}),
    [data?.sourceFreshness],
  );

  const partialFailureLine = useMemo(
    () =>
      data?.sourceStatus
        ? formatPartialSourceFailureLine(data.sourceStatus, data.slots.length)
        : "",
    [data?.sourceStatus, data?.slots.length],
  );

  const hubFailed = !loading && (hubLoadState === "failed" || Boolean(unexpectedError));
  const hubEmpty = !loading && hubLoadState === "empty";

  const heroListingCountState = useMemo(
    () =>
      deriveExploreHeroListingCountState({
        loading,
        unexpectedError: Boolean(unexpectedError),
        hubLoadState,
        loadedScopeCount: hubCounts.loadedScopeCount,
      }),
    [loading, unexpectedError, hubLoadState, hubCounts.loadedScopeCount],
  );



  const toggleChip = (label: string) => {

    setChips((all) => (all.includes(label) ? all.filter((x) => x !== label) : [...all, label]));

  };



  const openDetail = (id: string) => setDetailId(id);

  const closeDetail = () => setDetailId(null);

  const saveDetail = async (id: string) => {
    const slot = allSlotsById.get(id);
    if (!slot) return;
    const ok = await hubSaves.saveListing(slot);
    if (ok) setDetailId(null);
  };



  const ask = (value?: string) => {

    if (value) setPrompt(value);

    setAnswered(true);

  };



  const handleLocationScope = useCallback(
    (scope: Parameters<typeof applyLocationScope>[0]) => {
      applyLocationScope(scope);
      setPickedCityBanner(scope.label);
    },
    [applyLocationScope],
  );

  const handleCityChange = useCallback(

    (next: string) => {

      setCity(next);

      setPickedCityBanner(null);

    },

    [setCity],

  );



  return (

    <div
      className={`${styles.page} ${hubSaves.savedSlotIds.length ? styles.pageWithSavedBar : ""}`}
      data-explore-saved-bar={hubSaves.savedSlotIds.length > 0}
    >

      <main>

        <section className={styles.hero}>

          <HeroLocationWidget

            currentCity={displayCity}

            signedIn={Boolean(user)}

            listingCountState={heroListingCountState}

            onCityChange={handleCityChange}
            onLocationScope={handleLocationScope}
          />

          <div className={styles.heroContent}>

            <span className={styles.livePill}>

              <i />

              PROVIDER PRICES · FEES AT CHECKOUT

            </span>

            <h1>

              What are you doing <em>tonight?</em>

            </h1>

            <p>

              Ask in plain words. Rovvy reads every provider in {displayCity}, checks who&apos;s free and comes back with a plan

              you can book.

            </p>

            <div className={styles.prompt}>

              <label className="sr-only" htmlFor="plan-prompt">

                Describe your plans

              </label>

              <textarea

                id="plan-prompt"

                ref={promptRef}

                rows={1}

                value={prompt}

                onChange={(event) => {

                  setPrompt(event.target.value);

                  syncPromptHeight();

                }}

              />

              <div>

                <span>

                  {EXPLORE_PROMPT_SUGGESTIONS.map((x) => (

                    <button type="button" key={x} onClick={() => setPrompt(x)}>

                      {x.replace(", walkable", "")}

                    </button>

                  ))}

                </span>

                <button

                  type="button"

                  className={styles.planItBtn}

                  onClick={() => ask()}

                  disabled={loading || hubCounts.loadedScopeCount === 0}

                >

                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>

                    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />

                  </svg>

                  Plan it

                </button>

              </div>

            </div>

            <div className={styles.when}>

              {EXPLORE_WHEN_OPTIONS.map((x) => (

                <button

                  type="button"

                  key={x}

                  className={when === x && !calendarDayIso ? styles.whenSelected : ""}

                  onClick={() => {
                    setWhen(x);
                    setCalendarDayIso(null);
                  }}

                >

                  {x}

                </button>

              ))}

              <button type="button" className={styles.refineBtn} onClick={() => setFiltersOpen((v) => !v)}>

                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>

                  <path d="M4 7h16M7 12h10M10 17h4" />

                </svg>

                Refine{chipCount ? ` · ${chipCount}` : ""}

              </button>

            </div>

            {!loading && loadedScopeSlots.length > 0 ? (
              <ExploreHubCalendarStrip
                days={calendarDays}
                selectedDayIso={calendarDayIso}
                onSelectDay={(iso) => {
                  setCalendarDayIso(iso);
                }}
                onClearDay={() => setCalendarDayIso(null)}
              />
            ) : null}

          </div>

        </section>



        <section className={styles.pulseBar}>

          <div>

            <span>

              <i />

              Explore listings

            </span>

            <p role={loading ? "status" : hubFailed ? "alert" : hubEmpty ? "status" : undefined}>

              {loading ? (

                <>Loading listings for {displayCity}…</>

              ) : hubFailed ? (

                <>

                  Explore listings couldn&apos;t load for {displayCity}.{" "}

                  <button type="button" className={styles.broadcastBtn} onClick={() => retry()}>

                    Retry

                  </button>

                </>

              ) : hubEmpty ? (

                <>No listings found for {displayCity} and the selected dates.</>

              ) : showInventorySections ? (

                <>

                  {calendarScopeLine ? <>{calendarScopeLine} · </> : null}

                  {feedSummaryLine} · {listingSourcesLine}

                  {freshnessLine ? <> · {freshnessLine}</> : null}

                </>

              ) : null}

            </p>

          </div>

        </section>



        {hubPartial && partialFailureLine ? (
          <section className={styles.note} role="status">
            {partialFailureLine}{" "}
            <button type="button" className={styles.broadcastBtn} onClick={() => retry()}>
              Retry
            </button>
          </section>
        ) : null}

        {hubSaves.user && hubSaves.reloadError ? (
          <section className={styles.savesReloadBanner} role="alert">
            <span>
              Could not restore your saved listings from My Space: {hubSaves.reloadError} Saved marks may
              be wrong until reload succeeds.
            </span>
            <button
              type="button"
              className={styles.broadcastBtn}
              disabled={hubSaves.reloadState === "loading"}
              onClick={() => void hubSaves.retryReloadSaves()}
            >
              {hubSaves.reloadState === "loading" ? "Retrying…" : "Retry"}
            </button>
          </section>
        ) : null}

        {showInventorySections && stats.length > 0 ? (

          <section className={styles.stats}>

            {stats.map(({ count, label, accent }) => (

              <button

                type="button"

                key={label}

                className={`${styles.statChip} ${chips.includes(label) ? styles.statChipOn : ""}`}

                onClick={() => toggleChip(label)}

              >

                <b className={accent ? styles.accentText : undefined}>{count}</b>

                <span>{label}</span>

              </button>

            ))}

          </section>

        ) : null}



        <section className={styles.vibes}>

          <small>Vibe</small>

          <div>

            {EXPLORE_VIBES.map((x) => (

              <ExploreFilterChip key={x} label={x} selected={chips.includes(x)} onToggle={() => toggleChip(x)} />

            ))}

          </div>

        </section>



        {filtersOpen && (

          <section className={styles.filters}>

            <div>

              <div className={styles.filterGroups}>

                {FILTER_GROUPS.map(([name, items]) => (

                  <div key={name}>

                    <small>{name}</small>

                    <span>

                      {items.map((x) => (

                        <ExploreFilterChip key={x} label={x} selected={chips.includes(x)} onToggle={() => toggleChip(x)} />

                      ))}

                    </span>

                  </div>

                ))}

              </div>

              <ExploreLocationSearch
                activeLabel={locationScope?.label ?? null}
                onSelect={handleLocationScope}
              />

              <footer>

                <button type="button" onClick={() => setChips([])}>

                  Clear all

                </button>

                <button type="button" onClick={() => setFiltersOpen(false)}>

                  Show {hubCounts.matchingCount} listings

                </button>

              </footer>

            </div>

          </section>

        )}



        {answered && wayraPlans.length > 0 && (

          <section className={styles.wayraAnswer}>

            <div className={styles.wayraAnswerInner}>

              <header>

                <div>

                  <span className={styles.wayraBadge}>✦ Wayra answered</span>

                  <h2>Three ways to spend it — from live listings in {displayCity}</h2>

                </div>

                <button type="button" className={styles.wayraClose} onClick={() => setAnswered(false)} aria-label="Close">

                  ×

                </button>

              </header>

              <div className={styles.wayraPlans}>

                {wayraPlans.map((plan) => (

                  <ExploreWayraPlanCard key={plan.id} plan={plan} />

                ))}

              </div>

            </div>

          </section>

        )}



        {answered && !wayraPlans.length && showInventorySections ? (

          <section className={styles.note} role="status">

            No listings matched that prompt in {displayCity}. Try clearing filters or pick another city.

          </section>

        ) : null}



        {showInventorySections && zeroFilterMatch ? (

          <section className={styles.note} role="status">

            No listings match your filters in {displayCity}.{" "}

            <button type="button" className={styles.sheetRsvpBtn} onClick={() => setChips([])}>

              Clear filters

            </button>

          </section>

        ) : null}



        {showInventorySections ? (
        <section className={styles.masonry}>

          {masonryFeed.map((item) => {

            if (item.kind === "slot") {
              const slotModel = slotById.get(item.id);
              const isSaved = slotModel ? hubSaves.isListingSaved(slotModel) : false;
              return (
                <ExploreSlotCard key={item.id} slot={item} onOpen={openDetail} isSaved={isSaved} />
              );
            }

            if (item.kind === "ask") return <ExploreAskCard key={item.id} card={item} onClick={ask} />;

            if (item.kind === "live") {

              return (

                <button type="button" key={item.id} className={styles.liveCard} onClick={() => ask("Show me tonight's events")}>

                  <span className={styles.liveCardLabel}>

                    <i />

                    Tonight

                  </span>

                  <b>

                    Browse events

                    <br />

                    for {when.toLowerCase()}

                  </b>

                  <small>From cached providers in {displayCity} — verify times on the listing.</small>

                  <span>Search listings →</span>

                </button>

              );

            }

            return null;

          })}

        </section>
        ) : null}

        {showLoadMore ? (
          <section className={styles.note} aria-live="polite">
            <button
              type="button"
              className={styles.hubLoadMoreBtn}
              onClick={() => setVisibleLimit((limit) => limit + EXPLORE_HUB_PAGE_SIZE)}
            >
              {formatLoadMoreButtonLabel(hubCounts.visibleCount, hubCounts.matchingCount)}
            </button>
            {" "}
            Showing {hubCounts.visibleCount} of {hubCounts.matchingCount} loaded listings
          </section>
        ) : null}

        {showInventorySections ? (
        <p className={styles.note}>

          Listings come from cached provider responses for your location and dates. Verify times, prices, and availability on each provider page before booking.

        </p>
        ) : null}



        {showInventorySections && ranking.length > 0 ? (

          <section className={styles.ranking}>

            <header>

              <h2>Explore picks in {displayCity}</h2>

            </header>

            <div className={styles.table}>

              <div className={styles.tableHead}>

                <span>Place</span>

                <span>Price</span>

                <span>Availability</span>

              </div>

              {ranking.map((row) => (

                <ExploreRankingRow key={row.id} row={row} onOpen={openDetail} />

              ))}

            </div>

          </section>

        ) : null}



        <ExploreDestinationsSection
          onApplyScope={handleLocationScope}
          activeScopeLabel={locationScope?.label ?? pickedCityBanner}
          onResetCity={() => {
            clearLocationScope();
            setCity(EXPLORE_CITY);
            setPickedCityBanner(null);
          }}
        />

      </main>



      <ExploreSavedBar

        savedIds={hubSaves.savedSlotIds}

        slotLookup={(id) => hubSlotToDetail(allSlotsById.get(id))}

        onClear={hubSaves.clearSessionSelection}

      />

      <ExploreDetailDrawer
        detail={detail}
        onClose={closeDetail}
        onSave={saveDetail}
        isSaved={detail ? hubSaves.saveUiState(detail.id) === "saved" : false}
        saveState={detail ? hubSaves.saveUiState(detail.id) : "idle"}
        saveError={detail ? hubSaves.saveError(detail.id) : null}
      />

    </div>

  );

}
