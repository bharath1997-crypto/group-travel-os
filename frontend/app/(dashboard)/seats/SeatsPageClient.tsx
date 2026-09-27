"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import InlineSignInModal from "@/app/(dashboard)/live/InlineSignInModal";
import { RideCard, type BookSuccessPayload } from "./RideCard";
import { SeatsFindEmptyState } from "./SeatsFindEmptyState";
import { SeatsFlowSuccess } from "./SeatsFlowSuccess";
import { SeatsOfferWizard } from "./SeatsOfferWizard";
import { SeatsSearchBar, type SeatsSearchState } from "./SeatsSearchBar";
import { SeatsTabHero } from "./SeatsTabHero";
import { findRouteOption, isSeatShareSearchReady } from "./seats-route";
import { useSeatShareRoutes } from "./use-seat-share-routes";
import { loadSeatsRoutePanelModule } from "./seats-page-loader";
import { SeatsYourRidesTab } from "./SeatsYourRidesTab";
import {
  createRouteWatch,
  fetchSeatsMe,
  searchSeats,
  type SeatRideCard,
  type SeatsMe,
  type SeatsMode,
  type SeatsSort,
} from "./seats-api";
import { isSeatsAuthError } from "./seats-api-errors";
import { buildDemoSeatRideCards } from "./seats-demo-cards";
import { reformatSeatShareMoney } from "./seats-money";
import {
  filterRidesAfterTime,
  PROMPT_FROM,
  PROMPT_TO,
  tomorrowIsoDate,
  withResolvedCountryCode,
} from "./seats-location";
import { resolveSeatShareCurrency } from "./seats-currency";
import { SeatsNotifyBell } from "./SeatsNotifyBell";
import styles from "./seats.module.css";

const SeatsRoutePanel = dynamic(
  () => loadSeatsRoutePanelModule().then((m) => m.SeatsRoutePanel),
  {
    ssr: false,
    loading: () => (
      <p className={`${styles.routeStatus} ${styles.mono}`}>Loading route map…</p>
    ),
  },
);

export default function SeatsPageClient() {
  const [mode, setMode] = useState<SeatsMode>("find");
  const [sort, setSort] = useState<SeatsSort>("earliest");
  const [searchState, setSearchState] = useState<SeatsSearchState>(() => ({
    from: PROMPT_FROM,
    to: PROMPT_TO,
    date: tomorrowIsoDate(),
    time: "06:00",
    seats: 1,
  }));
  const {
    options: routeOptions,
    loading: routesLoading,
    error: routeError,
    selectedRouteId,
    setSelectedRouteId,
    selectedRoute,
  } = useSeatShareRoutes(searchState.from, searchState.to, mode === "find");
  const searchCurrency = useMemo(
    () =>
      resolveSeatShareCurrency(
        withResolvedCountryCode(searchState.from),
        withResolvedCountryCode(searchState.to),
      ),
    [searchState.from, searchState.to],
  );

  const applySearchCurrency = useCallback(
    (cards: SeatRideCard[]) =>
      cards.map((r) => ({
        ...r,
        price_per_seat: reformatSeatShareMoney(r.price_per_seat, searchCurrency),
      })),
    [searchCurrency],
  );

  const [rides, setRides] = useState<SeatRideCard[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchCompleted, setSearchCompleted] = useState(false);
  const [watching, setWatching] = useState(false);
  const [watchError, setWatchError] = useState<string | null>(null);
  const [me, setMe] = useState<SeatsMe | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const [tripFlash, setTripFlash] = useState<{
    eyebrow: string;
    title: string;
    body: string;
  } | null>(null);

  const loadSearch = useCallback(
    async (state: SeatsSearchState = searchState) => {
      const route = findRouteOption(routeOptions, selectedRouteId);
      if (!isSeatShareSearchReady(state.from, state.to, route)) return;
      setSearchCompleted(true);
      try {
        const res = await searchSeats({
          from_lat: state.from.lat,
          from_lon: state.from.lng,
          to_lat: state.to.lat,
          to_lon: state.to.lng,
          date: state.date,
          seats: state.seats,
          sort,
        });
        const filtered = filterRidesAfterTime(res, state.date, state.time);
        setRides(applySearchCurrency(filtered));
        setTotalCount(filtered.length);
      } catch {
        const fallback = filterRidesAfterTime(
          buildDemoSeatRideCards(state.from, state.to).filter(
            (r) => r.seats_free >= state.seats,
          ),
          state.date,
          state.time,
        );
        setRides(fallback);
        setTotalCount(fallback.length);
      }
    },
    [searchState, sort, routeOptions, selectedRouteId, applySearchCurrency],
  );

  const loadMe = useCallback(async () => {
    try {
      const res = await fetchSeatsMe();
      setMe(res);
    } catch {
      setMe({
        driving: [],
        riding: [],
        history_driving: [],
        history_riding: [],
        pending_as_driver: [],
        pending_count: 0,
        profile_public: true,
      });
    }
  }, []);

  useEffect(() => {
    if (mode !== "find") return;
    if (!isSeatShareSearchReady(searchState.from, searchState.to, selectedRoute)) return;
    void loadSearch();
  }, [mode, sort, loadSearch, searchState, selectedRoute?.id, selectedRoute?.isEligible]);

  const onSearch = useCallback(() => {
    void loadSearch();
  }, [loadSearch]);

  const searchReady = isSeatShareSearchReady(searchState.from, searchState.to, selectedRoute);
  const searchDisabledTitle = !searchState.from.isConfirmed
    ? "Confirm your starting point first"
    : !searchState.to.isConfirmed
      ? "Confirm your destination first"
      : !selectedRoute
        ? "Select a drivable route"
        : !selectedRoute.isEligible
          ? "Route must be within 200 miles"
          : undefined;

  useEffect(() => {
    if (mode !== "yours") return;
    void loadMe();
    const t = setInterval(() => void loadMe(), 30_000);
    return () => clearInterval(t);
  }, [mode, loadMe]);

  const fitNote = `${rides.length} of ${totalCount} fit ${searchState.seats} seat${searchState.seats === 1 ? "" : "s"}`;
  const timeLabel = searchState.time
    ? new Date(`${searchState.date}T${searchState.time}:00`).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : "your window";

  const pendingBadge = me?.pending_count ?? 0;
  const showFindEmpty = searchCompleted && searchReady && rides.length === 0;

  const onWatch = useCallback(async () => {
    if (!searchReady) return;
    setWatchError(null);
    try {
      await createRouteWatch({
        from_lat: searchState.from.lat,
        from_lon: searchState.from.lng,
        to_lat: searchState.to.lat,
        to_lon: searchState.to.lng,
        from_label: searchState.from.address || null,
        to_label: searchState.to.address || null,
        date_from: searchState.date,
        seats: searchState.seats,
      });
      setWatching(true);
    } catch (e: unknown) {
      setWatching(false);
      if (isSeatsAuthError(e)) {
        setSignInOpen(true);
        setWatchError("Log in to watch this route.");
        return;
      }
      setWatchError("Could not save route watch. Try again.");
    }
  }, [searchReady, searchState]);

  function onTaken(id: string) {
    setRides((prev) =>
      prev.map((r) => (r.id === id ? { ...r, seats_free: 0, seats_offered: r.seats_offered } : r)),
    );
  }

  function onBookSuccess(payload: BookSuccessPayload) {
    const held = payload.status === "held" || payload.status === "requested";
    setTripFlash({
      eyebrow: held ? "REQUEST SENT" : "BOOKED",
      title: held
        ? `Waiting for ${payload.driverName} to approve`
        : `You're on ${payload.driverName}'s trip`,
      body: held
        ? "We'll keep your request on hold until the driver responds. Check Your rides for status."
        : "Your seat is confirmed. Pay the driver directly — Rovvy does not move money.",
    });
    setMode("yours");
    void loadMe();
  }

  function onPublishedRide() {
    setTripFlash({
      eyebrow: "PUBLISHED",
      title: "Your ride is live",
      body: "Riders on your corridor can now find and book seats. Manage requests under Your rides.",
    });
    setMode("yours");
    void loadMe();
  }

  return (
    <div className={styles.page}>
      <InlineSignInModal isOpen={signInOpen} onClose={() => setSignInOpen(false)} />

      <div className={styles.pageTopActions}>
        <div className={styles.modeRow}>
        {(
          [
            ["find", "Find a seat"],
            ["offer", "+ Offer a ride"],
            ["yours", "Your rides"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`${styles.modeBtn} ${mode === id ? styles.modeBtnActive : ""}`}
            onClick={() => setMode(id)}
          >
            {label}
            {id === "yours" && pendingBadge > 0 ? (
              <span className={styles.modeBadge}>{pendingBadge}</span>
            ) : null}
          </button>
        ))}
        </div>
        <div className={styles.mobileNotifyBell} aria-hidden={false}>
          <SeatsNotifyBell />
        </div>
      </div>

      {mode === "find" ? (
        <>
          <SeatsTabHero variant="find" />

          <SeatsSearchBar
            state={searchState}
            onStateChange={setSearchState}
            onSearch={onSearch}
            searchDisabled={!searchReady}
            searchDisabledTitle={searchDisabledTitle}
          />

          <SeatsRoutePanel
            from={searchState.from}
            to={searchState.to}
            options={routeOptions}
            loading={routesLoading}
            error={routeError}
            selectedRouteId={selectedRouteId}
            onSelectRouteId={setSelectedRouteId}
          />

          <div className={styles.toolbar}>
            <div className={`${styles.sortRow} ${styles.sortTrack}`}>
              {(
                [
                  ["earliest", "Earliest"],
                  ["cheapest", "Cheapest"],
                  ["rated", "Best rated"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.sortBtn} ${sort === id ? styles.sortBtnActive : ""}`}
                  onClick={() => setSort(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className={`${styles.fitNote} ${styles.mono}`}>{fitNote}</span>
          </div>

          {showFindEmpty ? (
            <SeatsFindEmptyState
              timeLabel={timeLabel}
              onWatch={() => void onWatch()}
              watchDisabled={!searchReady}
              watchDisabledTitle={searchDisabledTitle}
              watching={watching}
              watchError={watchError}
            />
          ) : (
            <div className={styles.list}>
              {rides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  seatsNeeded={searchState.seats}
                  onTaken={onTaken}
                  onBookSuccess={onBookSuccess}
                  onAuthRequired={() => setSignInOpen(true)}
                />
              ))}
            </div>
          )}

          {!showFindEmpty ? (
            <div className={`${styles.alertBox} ${watching ? styles.alertBoxWatching : ""}`}>
              <div>
                <p className={`${styles.alertEyebrow} ${styles.mono}`}>ROUTE ALERT</p>
                <h2 className={`${styles.alertTitle} ${styles.serif}`}>
                  Nothing leaving around {timeLabel} yet?
                </h2>
                <p className={styles.alertBody}>
                  Watch this route and get notified when a matching road trip is posted.
                </p>
                {watchError ? (
                  <p className={styles.inlineError} role="alert">
                    {watchError}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className={styles.alertBtn}
                onClick={() => void onWatch()}
                disabled={!searchReady || watching}
                title={searchDisabledTitle}
              >
                {watching ? "Watching this route ✓" : "Watch this route"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {mode === "offer" ? (
        <>
          <SeatsTabHero variant="offer" />
          <SeatsOfferWizard
            onPublished={onPublishedRide}
            onAuthRequired={() => setSignInOpen(true)}
          />
        </>
      ) : null}

      {mode === "yours" ? (
        <>
          <SeatsTabHero variant="yours" />
          {tripFlash ? (
            <SeatsFlowSuccess
              eyebrow={tripFlash.eyebrow}
              title={tripFlash.title}
              body={tripFlash.body}
              primaryLabel="Got it"
              onPrimary={() => setTripFlash(null)}
              secondaryLabel="Find another seat"
              onSecondary={() => {
                setTripFlash(null);
                setMode("find");
              }}
            />
          ) : null}
          <SeatsYourRidesTab data={me} onRefresh={loadMe} onAuthRequired={() => setSignInOpen(true)} />
        </>
      ) : null}
    </div>
  );
}
