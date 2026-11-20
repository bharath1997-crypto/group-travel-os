"use client";



import { ChevronDown, MapPin } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { emitOpenWayra } from "@/lib/open-wayra";



import { useDashboardUser } from "@/contexts/dashboard-user-context";

import { ExploreAskCard } from "./components/ExploreAskCard";

import { ExploreDestinationsSection } from "./components/ExploreDestinationsSection";
import { ExploreLocationSearch } from "./components/ExploreLocationSearch";

import { ExploreDetailDrawer } from "./components/ExploreDetailDrawer";

import { ExploreFilterChip } from "./components/ExploreFilterChip";

import { ExploreHubDateCalendar } from "./components/ExploreHubDateCalendar";

import { ExploreRankingRow } from "./components/ExploreRankingRow";

import { ExploreSavedBar } from "./components/ExploreSavedBar";

import { ExploreSlotCard } from "./components/ExploreSlotCard";
import { ExploreTopEventsRow } from "./components/ExploreTopEventsRow";
import { ExploreVideosSection } from "./components/ExploreVideosSection";
import { ExploreYoutubeLegalFooter } from "./components/ExploreYoutubeLegalFooter";
import {
  resolveDirectoryHubForScope,
  type DirectoryHubResolution,
} from "./explore-directory-resolve";
import { loadPickedPlace } from "./explore-picked-place";
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
  formatExplorePromptSuggestionLabel,
  getExplorePromptRecentTexts,
  recordExplorePromptRecent,
} from "./explore-prompt-recent";

import {

  buildMasonryFeed,

  filterHubSlotsByChips,

  hubSlotToCard,

  hubSlotToDetail,

  hubSlotsToRanking,
  nearestLocalExplorePicks,

  orderExploreSlotCardsForMasonry,

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
  DEFAULT_EXPLORE_WITHIN,
  EXPLORE_LOCAL_PLACE_MILES,
  EXPLORE_WITHIN_OPTIONS,
  type ExploreWithin,
} from "./explore-distance-filter";
import {
  buildCalendarDaySummaries,
  filterSlotsByTimeScope,
  formatCalendarSelectedLabel,
} from "./explore-hub-time-scope";
import {
  calendarFetchDateRange,
  calendarMonthFromIso,
  calendarMonthRange,
  currentCalendarMonth,
  dayCountsFromSummaries,
  formatCalendarChipLabel,
  hubFetchRangeForSelectedDay,
  type ExploreCalendarMonth,
} from "./explore-hub-calendar-month";
import { useExploreCalendarCounts } from "./use-explore-calendar-counts";

import styles from "./explore.module.css";
import WayraPlanCard from "@/components/ai/WayraPlanCard";
import { dateRangeForWhen } from "./explore-hub-dates";
import {
  applyTweak,
  classifyPlanError,
  planSavedIds,
  requestWayraPlan,
  type PlanTweak,
  type WayraPlanRequest,
  type WayraPlanResponse,
} from "@/lib/wayra/plan";



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
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<ExploreCalendarMonth>(() => currentCalendarMonth());

  // Picking a day narrows the hub events window to that day (When chips are inactive meanwhile).
  const calendarFetchRange = useMemo(() => hubFetchRangeForSelectedDay(calendarDayIso), [calendarDayIso]);
  // Window the calendar counts cover: open month from today onwards.
  const calendarCountsRange = useMemo(() => calendarFetchDateRange(calendarMonth), [calendarMonth]);

  const [within, setWithin] = useState<ExploreWithin>(DEFAULT_EXPLORE_WITHIN);

  const {
    city,
    setCity,
    locationScope,
    applyLocationScope,
    clearLocationScope,
    loading,
    unexpectedError,
    data,
    eventsPending,
    loadMoreEvents,
    loadingMore,
    eventsExhausted,
    retry,
  } = useExploreHub(when, calendarFetchRange, within);

  const [pickedCityBanner, setPickedCityBanner] = useState<string | null>(null);
  const restoredPin = useState(() => loadPickedPlace() != null)[0];
  const exploreLocationLockedRef = useRef(restoredPin);
  const [exploreLocationLocked, setExploreLocationLocked] = useState(restoredPin);

  const [prompt, setPrompt] = useState("");

  const [promptFocused, setPromptFocused] = useState(false);

  const [suggestionIndex, setSuggestionIndex] = useState(0);

  const [recentPrompts, setRecentPrompts] = useState<string[]>([]);

  const promptRef = useRef<HTMLTextAreaElement>(null);

  const wayraAnswerRef = useRef<HTMLElement>(null);

  const [planBusy, setPlanBusy] = useState(false);
  const [planResponse, setPlanResponse] = useState<WayraPlanResponse | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const lastPlanRequest = useRef<WayraPlanRequest | null>(null);

  const runPlan = useCallback(async (body: WayraPlanRequest) => {
    lastPlanRequest.current = body;
    setPlanOpen(true);
    setPlanBusy(true);
    setPlanError(null);
    try {
      setPlanResponse(await requestWayraPlan(body));
    } catch (err) {
      setPlanError(classifyPlanError(err).message);
    } finally {
      setPlanBusy(false);
    }
  }, []);

  const syncPromptHeight = useCallback(() => {

    const field = promptRef.current;

    if (!field) return;

    field.style.height = "auto";

    field.style.height = `${Math.min(field.scrollHeight, 116)}px`;

  }, []);



  useEffect(() => {

    syncPromptHeight();

  }, [prompt, syncPromptHeight]);

  useEffect(() => {
    setRecentPrompts(getExplorePromptRecentTexts());
  }, []);

  useEffect(() => {
    if (!promptFocused || prompt.trim().length > 0) return;
    const timer = window.setInterval(() => {
      setSuggestionIndex((index) => (index + 1) % EXPLORE_PROMPT_SUGGESTIONS.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [promptFocused, prompt]);

  const [filtersOpen, setFiltersOpen] = useState(false);

  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    const q = searchParams.get("q")?.trim();
    if (!q) return;
    setPrompt(q);
    setAnswered(true);
  }, [searchParams]);

  const [chips, setChips] = useState<string[]>([]);
  const [vibesOpen, setVibesOpen] = useState(false);
  const [whenOpen, setWhenOpen] = useState(false);
  const [videosShown, setVideosShown] = useState(false);
  const showVibes = vibesOpen || EXPLORE_VIBES.some((v) => chips.includes(v));

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
    exploreLocationLockedRef.current = true;
    setExploreLocationLocked(true);

  }, [searchParams, applyLocationScope]);

  const displayCity = data?.displayCity || locationScope?.label || city;

  const [directoryHub, setDirectoryHub] = useState<DirectoryHubResolution | null>(null);

  // A restored pin does not republish from the hero. Takes still need the nearest directory city.
  useEffect(() => {
    if (!locationScope) return;
    let cancelled = false;
    void resolveDirectoryHubForScope(locationScope).then((hub) => {
      if (!cancelled && hub) setDirectoryHub(hub);
    });
    return () => {
      cancelled = true;
    };
  }, [locationScope]);

  // The hero card owns the single GPS read. A restored pin stays locked so that read cannot replace it.
  useEffect(() => {
    exploreLocationLockedRef.current = exploreLocationLocked;
  }, [exploreLocationLocked]);

  const directoryContext = useMemo(() => {
    const hub = directoryHub;
    if (!hub) return null;
    const labelParts = hub.label.split(",").map((part) => part.trim());
    const countryLabel = labelParts[labelParts.length - 1] || hub.countryCode;
    const regionLabel =
      hub.admin1Slug && labelParts.length >= 2 ? labelParts[labelParts.length - 2] : null;
    return {
      countryCode: hub.countryCode,
      countrySlug: hub.countrySlug,
      admin1Slug: hub.admin1Slug ?? null,
      admin1Code: hub.stateCode ?? null,
      citySlug: hub.citySlug ?? null,
      cityName: hub.fetchCity,
      placeLabels: {
        city: hub.citySlug ? hub.fetchCity : null,
        region: regionLabel,
        country: countryLabel,
      },
    };
  }, [directoryHub]);

  const videosPlace = useMemo(() => {
    if (!directoryContext) return null;
    return {
      countryCode: directoryContext.countryCode,
      countrySlug: directoryContext.countrySlug,
      admin1Slug: directoryContext.admin1Slug,
      citySlug: directoryContext.citySlug,
      labels: directoryContext.placeLabels,
    };
  }, [directoryContext]);

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
          // A picked calendar day replaces the When chip; never label those cards "Tonight".
          when: calendarDayIso ? "calendar" : when,
          savedPlaceSlots,
          anchorLat: data.placesAnchor?.lat ?? locationScope?.lat,
          anchorLon: data.placesAnchor?.lng ?? locationScope?.lon,
        }) ?? slot.reason,
    }));
  }, [loading, data, when, calendarDayIso, hubSaves.savedSlotIds, locationScope?.lat, locationScope?.lon]);
  const timeScopedSlots = useMemo(
    () => filterSlotsByTimeScope(loadedScopeSlots, when, calendarDayIso),
    [loadedScopeSlots, when, calendarDayIso],
  );
  const laterThisWeek = useMemo(() => {
    if (calendarDayIso || when.trim().toLowerCase() !== "tonight") return [];
    const tonight = new Set(timeScopedSlots.map((slot) => slot.id));
    return loadedScopeSlots
      .filter(
        (slot) =>
          slot.exploreListingKind === "event" &&
          !tonight.has(slot.id) &&
          Boolean(slot.eventDateIso),
      )
      .slice(0, 8);
  }, [calendarDayIso, when, timeScopedSlots, loadedScopeSlots]);
  const showInventorySections = timeScopedSlots.length > 0;
  // Per-day counts: SQL counts from /explore/events/calendar; fall back to the loaded pool when
  // the city has no Scaper index or the request failed.
  const calendarCounts = useExploreCalendarCounts({
    city: data?.city ?? null,
    range: calendarCountsRange,
    enabled: calendarOpen && locationScope?.lat == null,
  });
  const calendarUsesApiCounts = Boolean(calendarCounts.counts?.supported);
  const poolDayCounts = useMemo(
    () => dayCountsFromSummaries(buildCalendarDaySummaries(loadedScopeSlots, when, calendarMonthRange(calendarMonth))),
    [loadedScopeSlots, when, calendarMonth],
  );
  const calendarDayCounts = calendarUsesApiCounts ? calendarCounts.counts!.countsByIso : poolDayCounts;
  const calendarLoadedRange = calendarUsesApiCounts
    ? calendarCountsRange
    : !loading && data
      ? (calendarFetchRange ?? calendarCountsRange)
      : null;
  const calendarLoading = loading || calendarCounts.loading;
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

  const localPickMiles = useMemo(() => {
    if (within === "state") return null;
    if (typeof within === "number") return within;
    const lat = locationScope?.lat;
    const lon = locationScope?.lon;
    if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return EXPLORE_LOCAL_PLACE_MILES;
  }, [within, locationScope?.lat, locationScope?.lon]);
  const ranking = useMemo(
    () =>
      localPickMiles != null
        ? nearestLocalExplorePicks(matchingSlots, localPickMiles)
        : hubSlotsToRanking(visibleSlots),
    [localPickMiles, matchingSlots, visibleSlots],
  );
  const showRankingTable = ranking.length > 0;

  const masonryFeed = useMemo(() => {
    const cards = orderExploreSlotCardsForMasonry(
      visibleSlots.map((slot, index) => hubSlotToCard(slot, index)),
    );
    return buildMasonryFeed(cards);
  }, [visibleSlots]);



  const wayraPlans = useMemo(

    () => (answered ? slotsToWayraPlans(matchingSlots, prompt, when) : []),

    [answered, matchingSlots, prompt, when],

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

  const showLoadMore =
    showInventorySections &&
    !zeroFilterMatch &&
    (hubCounts.hasMore || (locationScope?.lat != null && !eventsExhausted));

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
  const showSavesReloadBanner =
    Boolean(hubSaves.user && hubSaves.reloadError) && !loading && !hubFailed;

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



  const planLat = data?.placesAnchor?.lat ?? locationScope?.lat;
  const planLon = data?.placesAnchor?.lng ?? locationScope?.lon;
  const canPlanWithWayra = typeof planLat === "number" && typeof planLon === "number";

  const startWayraPlan = () => {
    if (!canPlanWithWayra) return;
    const range = calendarDayIso ? { dateFrom: calendarDayIso, dateTo: calendarDayIso } : dateRangeForWhen(when);
    void runPlan({
      lat: planLat,
      lon: planLon,
      message: prompt.trim().slice(0, 300),
      date_from: range.dateFrom,
      date_to: range.dateTo,
      saved_ids: planSavedIds(hubSaves.savedSlotIds),
    });
  };

  const tweakWayraPlan = (tweak: PlanTweak) => {
    if (lastPlanRequest.current) void runPlan(applyTweak(lastPlanRequest.current, tweak));
  };

  const ask = (value?: string) => {

    const next = (value ?? prompt).trim();

    if (value) setPrompt(value);

    if (next) {
      recordExplorePromptRecent(next);
      setRecentPrompts(getExplorePromptRecentTexts());
    }

    setAnswered(true);

  };

  useEffect(() => {
    if (!answered) return;
    wayraAnswerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [answered, wayraPlans.length]);

  const applyPromptSuggestion = (text: string) => {
    setPrompt(text);
    syncPromptHeight();
    promptRef.current?.focus();
  };

  const promptIsEmpty = !prompt.trim();

  const activeSuggestion = formatExplorePromptSuggestionLabel(
    EXPLORE_PROMPT_SUGGESTIONS[suggestionIndex] ?? "",
  );

  const showPromptHints = promptFocused && promptIsEmpty;



  const handleLocationScope = useCallback(
    (scope: Parameters<typeof applyLocationScope>[0]) => {
      exploreLocationLockedRef.current = true;
      setExploreLocationLocked(true);
      applyLocationScope(scope);
      setPickedCityBanner(scope.label);
      const cityName = (scope.fetchCity || scope.city || "").split(",")[0].trim();
      setDirectoryHub((current) =>
        current && cityName && current.fetchCity.toLowerCase() === cityName.toLowerCase() ? current : null,
      );
      void resolveDirectoryHubForScope(scope).then((hub) => {
        if (hub) setDirectoryHub(hub);
      });
    },
    [applyLocationScope],
  );

  const handleCityChange = useCallback(
    (next: string) => {
      exploreLocationLockedRef.current = true;
      setExploreLocationLocked(true);
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

        <section className={styles.hero} data-explore-hero>

          <HeroLocationWidget

            currentCity={displayCity}

            signedIn={Boolean(user)}

            listingCountState={heroListingCountState}

            onCityChange={handleCityChange}
            onLocationScope={handleLocationScope}
            syncScopeFromHero={!exploreLocationLocked}
            locationLocked={exploreLocationLocked}
            lockedScope={exploreLocationLocked ? locationScope : null}
          />

          <div className={styles.heroContent}>

            <span className={styles.livePill}>

              <i />

              Provider prices · fees at checkout

            </span>

            <h1>

              {when.trim().toLowerCase() === "tonight" || when.trim().toLowerCase() === "today" ? (
                <>What are you doing <em>tonight?</em></>
              ) : when.trim().toLowerCase() === "tomorrow" ? (
                <>What are you doing <em>tomorrow?</em></>
              ) : (
                <>What are you doing <em>{when.toLowerCase()}?</em></>
              )}

            </h1>

            <p>
              {`Ask in plain words. Rovvy searches cached listings for ${displayCity.trim()}\u00A0and suggests options from what's already loaded — verify times and prices on the provider page.`}
            </p>

            <div className={styles.prompt}>

              <label className="sr-only" htmlFor="plan-prompt">

                Describe your plans

              </label>

              <div className={styles.promptInputWrap}>
                <textarea

                  id="plan-prompt"

                  ref={promptRef}

                  rows={1}

                  value={prompt}

                  placeholder={promptFocused && promptIsEmpty ? "" : "Search loaded listings"}

                  autoComplete="off"

                  autoCorrect="off"

                  spellCheck={false}

                  onFocus={() => {
                    setPromptFocused(true);
                    setRecentPrompts(getExplorePromptRecentTexts());
                  }}

                  onBlur={() => {
                    setPromptFocused(false);
                  }}

                  onChange={(event) => {

                    setPrompt(event.target.value);

                    syncPromptHeight();

                  }}

                />
                {promptFocused && promptIsEmpty ? (
                  <span className={styles.promptGhost} aria-hidden key={activeSuggestion}>
                    {activeSuggestion}
                  </span>
                ) : null}
              </div>

              {showPromptHints ? (
                <div className={styles.promptHints}>
                  {recentPrompts.length > 0 ? (
                    <div className={styles.promptHintGroup}>
                      <span className={styles.promptHintLabel}>Recent</span>
                      <div className={styles.promptHintRow}>
                        {recentPrompts.map((text) => (
                          <button
                            type="button"
                            key={`recent-${text}`}
                            className={styles.promptHintChip}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => applyPromptSuggestion(text)}
                          >
                            {text}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className={styles.promptHintGroup}>
                    <span className={styles.promptHintLabel}>Try</span>
                    <div className={styles.promptHintRow}>
                      <button
                        type="button"
                        className={styles.promptHintChip}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() =>
                          applyPromptSuggestion(EXPLORE_PROMPT_SUGGESTIONS[suggestionIndex] ?? "")
                        }
                      >
                        {activeSuggestion}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className={styles.promptActions}>

                <button
                  type="button"
                  className={styles.planItWayraBtn}
                  onClick={() => {
                    const next = prompt.trim();
                    emitOpenWayra(next ? { prompt: next, autoSend: true } : undefined);
                  }}
                  aria-label="Ask Wayra"
                  title="Ask Wayra (AI agent)"
                >
                  ✦
                </button>

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

                <button
                  type="button"
                  className={styles.planItBtn}
                  onClick={startWayraPlan}
                  disabled={loading || planBusy || !canPlanWithWayra}
                  data-testid="plan-with-wayra"
                >
                  {planBusy ? "Planning…" : "Plan with Wayra"}
                </button>

              </div>

            </div>

            <div className={styles.when}>

              <button
                type="button"
                className={`${styles.whenToggle} ${styles.whenSelected}`}
                aria-expanded={whenOpen}
                onClick={() => setWhenOpen((v) => !v)}
              >
                {calendarDayIso ? formatCalendarChipLabel(calendarDayIso) : when}
                <ChevronDown size={14} aria-hidden="true" className={whenOpen ? styles.chevronOpen : undefined} />
              </button>

              {whenOpen ? (
                <>
              {EXPLORE_WHEN_OPTIONS.map((x) => (

                <button

                  type="button"

                  key={x}

                  className={when === x && !calendarDayIso ? styles.whenSelected : ""}

                  onClick={() => {
                    setWhen(x);
                    setCalendarDayIso(null);
                    setWhenOpen(false);
                  }}

                >

                  {x}

                </button>

              ))}

              <button
                type="button"
                className={`${styles.dateSelectBtn} ${calendarDayIso ? styles.whenSelected : ""}`}
                aria-expanded={calendarOpen}
                aria-controls="explore-date-calendar"
                onClick={() => setCalendarOpen((v) => !v)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M3 10h18M8 3v4M16 3v4" />
                </svg>
                {calendarDayIso ? formatCalendarChipLabel(calendarDayIso) : "Select the date"}
              </button>

              <label className={`${styles.withinSelectWrap} ${within !== DEFAULT_EXPLORE_WITHIN ? styles.whenSelected : ""}`}>
                <span>Within</span>
                <select
                  className={styles.withinSelect}
                  aria-label="Show events within"
                  value={String(within)}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setWithin(raw === "city" || raw === "state" ? raw : Number(raw));
                  }}
                >
                  {EXPLORE_WITHIN_OPTIONS.map((option) => (
                    <option key={String(option.value)} value={String(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

                </>
              ) : null}

              <button type="button" className={styles.refineBtn} onClick={() => setFiltersOpen((v) => !v)}>

                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>

                  <path d="M4 7h16M7 12h10M10 17h4" />

                </svg>

                Refine{chipCount ? ` · ${chipCount}` : ""}

              </button>

            </div>

            {calendarOpen ? (
              <div id="explore-date-calendar" className={styles.dateCalAnchor}>
                <ExploreHubDateCalendar
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  countsByIso={calendarDayCounts}
                  loadedRange={calendarLoadedRange}
                  loading={calendarLoading}
                  selectedDayIso={calendarDayIso}
                  onSelectDay={(iso) => {
                    setCalendarDayIso(iso);
                    setCalendarMonth(calendarMonthFromIso(iso));
                    setCalendarOpen(false);
                  }}
                  onClearDay={() => setCalendarDayIso(null)}
                  onClose={() => setCalendarOpen(false)}
                />
              </div>
            ) : null}

          </div>

        </section>



        {planOpen ? (
          <section className={styles.wayraAnswer} aria-live="polite">
            <div style={{ position: "relative" }}>
              <button type="button" className={styles.wayraClose} onClick={() => setPlanOpen(false)} aria-label="Close plan" style={{ position: "absolute", right: 8, top: 8, zIndex: 1, color: "#0f172a" }}>
                ×
              </button>
              {planError ? (
                <div role="alert" className={styles.note}>{planError}</div>
              ) : planResponse ? (
                <WayraPlanCard response={planResponse} busy={planBusy} onTweak={tweakWayraPlan} />
              ) : (
                <div role="status" className={styles.note}>Wayra is planning…</div>
              )}
            </div>
          </section>
        ) : null}

        {answered && wayraPlans.length > 0 ? (
          <section ref={wayraAnswerRef} className={styles.wayraAnswer}>
            <div className={styles.wayraAnswerInner}>
              <header>
                <div>
                  <span className={styles.wayraBadge}>From loaded listings</span>
                  <h2>
                    {wayraPlans.length === 1
                      ? `One option from listings in ${displayCity}`
                      : `${wayraPlans.length} options from listings in ${displayCity}`}
                  </h2>
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
        ) : null}

        {answered && !wayraPlans.length && showInventorySections ? (
          <section ref={wayraAnswerRef} className={styles.note} role="status">
            {prompt.trim()
              ? `No listings matched “${prompt.trim()}” in ${displayCity} for ${when.toLowerCase()}. Try clearing filters or another city.`
              : `No plan picks available in ${displayCity} for ${when.toLowerCase()}. Load listings first or clear filters.`}
          </section>
        ) : null}



        {loading || hubFailed || hubEmpty ? (
        <section className={styles.pulseBar}>

          <div>

            <span>

              <MapPin size={14} aria-hidden="true" />

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
        ) : null}



        {eventsPending ? (
          <section className={styles.note} role="status">
            Events are still loading. Places are shown below.
          </section>
        ) : null}

        {hubPartial && partialFailureLine ? (
          <section className={styles.note} role="status">
            {partialFailureLine}{" "}
            <button type="button" className={styles.broadcastBtn} onClick={() => retry()}>
              Retry
            </button>
          </section>
        ) : null}

        {showSavesReloadBanner ? (
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



        <div className={styles.filtersToggle}>
          <button
            type="button"
            className={styles.filtersToggleBtn}
            aria-expanded={showVibes}
            onClick={() => setVibesOpen((open) => !open)}
          >
            {showVibes ? "Hide filters" : "Filters"}
            <ChevronDown size={14} aria-hidden="true" className={showVibes ? styles.chevronOpen : undefined} />
          </button>
        </div>

        {showVibes ? (
          <section className={styles.vibes}>
            <small>Vibe</small>
            <div>
              {EXPLORE_VIBES.map((x) => (
                <ExploreFilterChip key={x} label={x} selected={chips.includes(x)} onToggle={() => toggleChip(x)} />
              ))}
            </div>
          </section>
        ) : null}

        {showInventorySections ? (
          <>
            <ExploreTopEventsRow
              loadedSlots={matchingSlots}
              directory={directoryContext}
              filtersActive={filtersActive}
              locationLabel={locationScope?.label ?? displayCity}
              orderBy={localPickMiles != null ? "nearest" : "soonest"}
            />
            <ExploreVideosSection onVisibleChange={setVideosShown} place={videosPlace} />
          </>
        ) : null}

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

        {laterThisWeek.length > 0 ? (
          <section className={styles.masonry} aria-label="Later this week">
            <h2>Later this week</h2>
            <p className={styles.noteQuiet}>
              Tonight is only today in {displayCity}. These are the next events from the same search.
            </p>
            {laterThisWeek.map((slot, index) => (
              <ExploreSlotCard key={`later-${slot.id}`} slot={hubSlotToCard(slot, index)} onOpen={openDetail} />
            ))}
          </section>
        ) : null}

        {showLoadMore ? (
          <section className={styles.note} aria-live="polite">
            <button
              type="button"
              className={styles.hubLoadMoreBtn}
              disabled={loadingMore}
              onClick={() => {
                if (hubCounts.visibleCount < hubCounts.matchingCount) {
                  setVisibleLimit((limit) => limit + EXPLORE_HUB_PAGE_SIZE);
                  return;
                }
                if (!eventsExhausted) void loadMoreEvents();
              }}
            >
              {loadingMore
                ? "Loading more…"
                : eventsExhausted
                  ? "That's everything in this search"
                  : formatLoadMoreButtonLabel(hubCounts.visibleCount, hubCounts.matchingCount)}
            </button>
            {" "}
            Showing {hubCounts.visibleCount} of {hubCounts.matchingCount} loaded listings
          </section>
        ) : null}

        {showInventorySections ? (
        <p className={styles.noteQuiet}>

          Listings come from cached provider responses for your location and dates. Events with no venue coordinates are left out of a distance search. Verify times, prices, and availability on each provider page before booking.

          {listingSourcesLine ? <> {listingSourcesLine}</> : null}
          {freshnessLine ? <> · {freshnessLine}</> : null}

        </p>
        ) : null}

        {showInventorySections && videosShown ? (
          <div className={styles.noteQuiet}>
            <ExploreYoutubeLegalFooter />
          </div>
        ) : null}



        {showInventorySections && showRankingTable ? (

          <section className={styles.ranking}>

            <header>

              <h2>
                {localPickMiles != null ? "Explore picks near" : "Explore picks in"} {displayCity}
              </h2>
              {localPickMiles != null ? (
                <p className={styles.noteQuiet}>
                  Closest events within {localPickMiles} miles, then places. A row can be in a neighboring town.
                </p>
              ) : null}

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



        {!loading ? (
        <ExploreDestinationsSection
          onApplyScope={handleLocationScope}
          activeScopeLabel={locationScope?.label ?? pickedCityBanner}
          nearbyAnchor={
            locationScope?.lat != null && locationScope.lon != null
              ? {
                  lat: locationScope.lat,
                  lon: locationScope.lon,
                  state: locationScope.state,
                  city: locationScope.city || locationScope.fetchCity,
                  label: locationScope.label,
                }
              : null
          }
          surpriseHints={[
            locationScope?.city,
            locationScope?.country,
            displayCity,
            ...hubSaves.savedSlotIds
              .map((id) => allSlotsById.get(id)?.city || allSlotsById.get(id)?.area || "")
              .filter(Boolean),
          ].filter((value): value is string => Boolean(value && value.trim()))}
        />
        ) : null}

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
