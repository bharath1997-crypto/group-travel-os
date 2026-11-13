"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SeatsLocationPicker, PROMPT_FROM, PROMPT_TO } from "./SeatsLocationPicker";
import { previewRideCost, publishRide, type CostPreview } from "./seats-api";
import { isSeatsAuthError } from "./seats-api-errors";
import { buildPublishRidePayload, buildPublishRideStops } from "./seats-publish-payload";
import { resolveSeatShareCurrency } from "./seats-currency";
import { formatSeatShareMoney } from "./seats-money";
import { isSeatShareSearchReady, SEATSHARE_MAX_DISTANCE_MILES } from "./seats-route";
import { loadSeatsRoutePanelModule } from "./seats-page-loader";
import {
  SEATSHARE_VEHICLE_TYPES,
  type SeatShareVehicleType,
  vehicleDisplayLabel,
} from "./seats-vehicle";
import { useSeatShareRoutes } from "./use-seat-share-routes";
import { withResolvedCountryCode, type LocationPoint } from "./seats-location";
import type { Money } from "./seats-money";
import { clearOfferDraft, loadOfferDraft, saveOfferDraft } from "./seats-offer-draft";
import { majorTextToMinor, minorToMajorText } from "./seats-price-input";
import {
  isFutureDeparture,
  resolveOfferTimeZone,
  todayInZone,
  zonedDateTimeToUtc,
} from "./seats-time";
import styles from "./seats.module.css";

const TOTAL_STEPS = 4;
const DEFAULT_DEPART_TIME = "05:30";

const SeatsRoutePanel = dynamic(
  () => loadSeatsRoutePanelModule().then((m) => m.SeatsRoutePanel),
  {
    ssr: false,
    loading: () => (
      <p className={`${styles.routeStatus} ${styles.mono}`}>Loading route map…</p>
    ),
  },
);

type Props = {
  onPublished?: () => void;
  onAuthRequired?: () => void;
};

export function SeatsOfferWizard({ onPublished, onAuthRequired }: Props) {
  const [step, setStep] = useState(1);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [from, setFrom] = useState<LocationPoint>(PROMPT_FROM);
  const [to, setTo] = useState<LocationPoint>(PROMPT_TO);
  const [vehicleType, setVehicleType] = useState<SeatShareVehicleType>("sedan");
  const [departDate, setDepartDate] = useState("");
  const [departTime, setDepartTime] = useState(DEFAULT_DEPART_TIME);
  const [seatsOffered, setSeatsOffered] = useState(3);
  const [approval, setApproval] = useState<"instant" | "manual">("instant");
  const [pricePaise, setPricePaise] = useState<number | null>(null);
  const [priceText, setPriceText] = useState("");
  const [note, setNote] = useState("");
  const [cost, setCost] = useState<CostPreview | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [previewTick, setPreviewTick] = useState(0);
  const [capError, setCapError] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    const draft = loadOfferDraft();
    if (draft) {
      setFrom(draft.from);
      setTo(draft.to);
      setVehicleType(draft.vehicleType);
      setDepartDate(draft.departDate);
      setDepartTime(draft.departTime);
      setSeatsOffered(draft.seatsOffered);
      setApproval(draft.approval);
      setNote(draft.note);
      setDraftRestored(true);
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    saveOfferDraft({ from, to, vehicleType, departDate, departTime, seatsOffered, approval, note });
  }, [draftReady, from, to, vehicleType, departDate, departTime, seatsOffered, approval, note]);

  function resetWizard() {
    clearOfferDraft();
    setStep(1);
    setFrom(PROMPT_FROM);
    setTo(PROMPT_TO);
    setVehicleType("sedan");
    setDepartDate("");
    setDepartTime(DEFAULT_DEPART_TIME);
    setSeatsOffered(3);
    setApproval("instant");
    setNote("");
    setPricePaise(null);
    setPriceText("");
    setCost(null);
    setCapError(false);
    setPreviewError(false);
    setPublishError(null);
    setDraftRestored(false);
  }

  const {
    options: routeOptions,
    loading: routesLoading,
    error: routeError,
    selectedRouteId,
    setSelectedRouteId,
    selectedRoute,
  } = useSeatShareRoutes(from, to);

  const routeReady = isSeatShareSearchReady(from, to, selectedRoute);

  const offerCurrency = useMemo(
    () =>
      resolveSeatShareCurrency(withResolvedCountryCode(from), withResolvedCountryCode(to)),
    [from, to],
  );

  const showOfferMoney = useCallback(
    (minorUnits: number) => formatSeatShareMoney(minorUnits, offerCurrency).display,
    [offerCurrency],
  );

  const showOfferPrice = useCallback(
    (m: Money) => formatSeatShareMoney(m.amount_paise, offerCurrency).display,
    [offerCurrency],
  );

  const stops = useMemo(() => buildPublishRideStops(from, to), [from, to]);
  const timeZone = useMemo(() => resolveOfferTimeZone(withResolvedCountryCode(from)), [from]);
  const todayLocal = useMemo(() => todayInZone(timeZone), [timeZone]);
  const departureOk = departDate
    ? isFutureDeparture(departDate, departTime, timeZone)
    : false;

  useEffect(() => {
    if (step < 3) return;
    let cancelled = false;
    setPreviewError(false);
    (async () => {
      try {
        const preview = await previewRideCost({
          stops,
          mileage_kmpl: SEATSHARE_VEHICLE_TYPES.find((v) => v.id === vehicleType)?.mileageKmpl ?? 15,
          seats_offered: seatsOffered,
          tolls_paise: null,
        });
        if (!cancelled) {
          const max = preview.max_per_seat.amount_paise;
          setCost(preview);
          // Keep a price the driver already typed if it is still within the new cap.
          setPricePaise((prev) => {
            const next = prev !== null && prev <= max ? prev : max;
            setPriceText(minorToMajorText(next));
            return next;
          });
          setCapError(false);
        }
      } catch {
        if (!cancelled) {
          setCost(null);
          setPreviewError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, stops, seatsOffered, vehicleType, previewTick]);

  // Publishing is blocked until the server has returned a cap, so no price goes out unchecked.
  const maxCap = cost?.max_per_seat.amount_paise ?? null;
  const priceValid = pricePaise !== null && maxCap !== null && pricePaise <= maxCap;

  const step1Ready = routeReady && Boolean(vehicleType);

  async function publish() {
    if (!selectedRoute || !selectedRoute.isEligible) return;
    if (pricePaise === null || maxCap === null) return;
    if (pricePaise > maxCap) {
      setCapError(true);
      return;
    }
    const departInstant = zonedDateTimeToUtc(departDate, departTime, timeZone);
    if (!departInstant || !departureOk) {
      setPublishError("Pick a departure time that is still in the future.");
      return;
    }
    setPublishing(true);
    setPublishError(null);
    const depart_at = departInstant.toISOString();
    const arrive = new Date(departInstant.getTime() + selectedRoute.durationMinutes * 60_000);
    const arrive_est_at = arrive.toISOString();

    const payload = buildPublishRidePayload({
      from,
      to,
      selectedRoute,
      depart_at,
      arrive_est_at,
      seats_offered: seatsOffered,
      approval,
      price_per_seat_paise: pricePaise,
      vehicle_body_type: vehicleType,
      tolls_paise: null,
      note: note || null,
    });

    try {
      await publishRide(payload);
      onPublished?.();
      resetWizard();
    } catch (e: unknown) {
      if (isSeatsAuthError(e)) {
        onAuthRequired?.();
        setPublishError("Log in to publish your ride.");
      } else {
        setPublishError("Could not publish this ride. Check your price and try again.");
      }
    } finally {
      setPublishing(false);
    }
  }

  const publishDisabled =
    publishing || capError || !priceValid || !selectedRoute?.isEligible || !departureOk;

  const departureLabel = departDate
    ? `${departDate} ${departTime} (${timeZone})`
    : "Not set";

  return (
    <div className={styles.wizard}>
      <div className={styles.wizardProgress}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
          <span key={n} className={n <= step ? styles.wizardSegOn : styles.wizardSeg} />
        ))}
      </div>
      <p className={`${styles.eyebrow} ${styles.mono}`}>
        Offer a ride · step {step} of {TOTAL_STEPS}
      </p>
      {draftRestored && step === 1 ? (
        <p className={styles.hint}>
          We restored your unfinished ride.{" "}
          <button type="button" className={styles.wizardBack} onClick={resetWizard}>
            Start over
          </button>
        </p>
      ) : null}

      {step === 1 ? (
        <>
          <h2 className={`${styles.wizardTitle} ${styles.serif}`}>Your driving route</h2>
          <p className={styles.hint}>
            Confirm pickup and drop-off, pick the exact road path, and choose a four-wheeler only.
          </p>
          <div className={styles.wizardLocationStack}>
            <SeatsLocationPicker
              from={from}
              to={to}
              onFromChange={setFrom}
              onToChange={setTo}
              layout="wizard"
            />
          </div>

          <SeatsRoutePanel
            from={from}
            to={to}
            options={routeOptions}
            loading={routesLoading}
            error={routeError}
            selectedRouteId={selectedRouteId}
            onSelectRouteId={setSelectedRouteId}
          />

          <p className={styles.fieldLabel}>Vehicle type</p>
          <div className={styles.chipRow}>
            {SEATSHARE_VEHICLE_TYPES.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`${styles.chip} ${vehicleType === v.id ? styles.chipOn : ""}`}
                onClick={() => setVehicleType(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <p className={styles.hint}>
            Selected: {vehicleDisplayLabel(vehicleType)} · road trips up to{" "}
            {SEATSHARE_MAX_DISTANCE_MILES} miles
          </p>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <h2 className={`${styles.wizardTitle} ${styles.serif}`}>When & booking</h2>
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Date</span>
              <input
                type="date"
                min={todayLocal}
                value={departDate}
                onChange={(e) => setDepartDate(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Time</span>
              <input type="time" value={departTime} onChange={(e) => setDepartTime(e.target.value)} />
            </label>
          </div>
          <p className={styles.hint}>Times are in your pickup time zone: {timeZone}.</p>
          {departDate && !departureOk ? (
            <p className={styles.capError} role="alert">
              Pick a departure at least 15 minutes from now.
            </p>
          ) : null}
          <p className={styles.fieldLabel}>Seats offered</p>
          <div className={styles.seatPickRow}>
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                className={`${styles.seatPick} ${n <= seatsOffered ? styles.seatPickOn : ""}`}
                onClick={() => setSeatsOffered(n)}
                aria-label={`${n} seats`}
              />
            ))}
          </div>
          <div className={styles.chipRow}>
            <button
              type="button"
              className={`${styles.chip} ${approval === "instant" ? styles.chipOn : ""}`}
              onClick={() => setApproval("instant")}
            >
              Confirms at once
            </button>
            <button
              type="button"
              className={`${styles.chip} ${approval === "manual" ? styles.chipOn : ""}`}
              onClick={() => setApproval("manual")}
            >
              Driver approves
            </button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <h2 className={`${styles.wizardTitle} ${styles.serif}`}>Set your price</h2>
          <div className={styles.costBreakdown}>
            {cost ? (
              <>
                <div className={styles.costRow}>
                  <span>Fuel</span>
                  <span className={styles.mono}>
                    {showOfferMoney(Number(cost.cost_basis.fuel_paise ?? 0))}
                  </span>
                </div>
                <div className={styles.costRow}>
                  <span>Tolls</span>
                  <span className={styles.mono}>
                    {cost.cost_basis.tolls_paise != null
                      ? showOfferMoney(Number(cost.cost_basis.tolls_paise))
                      : "Not included"}
                  </span>
                </div>
                <div className={styles.costRow}>
                  <span>Total trip cost</span>
                  <span className={styles.mono}>{showOfferPrice(cost.cost_total)}</span>
                </div>
                <div className={styles.costRow}>
                  <span>Split {seatsOffered + 1} ways</span>
                  <span className={`${styles.mono} ${styles.accentText}`}>
                    {showOfferPrice(cost.max_per_seat)} max
                  </span>
                </div>
              </>
            ) : previewError ? (
              <div role="alert">
                <p className={styles.inlineError}>
                  Could not load the cost cap, so you can't publish yet.
                </p>
                <button
                  type="button"
                  className={styles.wizardBack}
                  onClick={() => setPreviewTick((t) => t + 1)}
                >
                  Try again
                </button>
              </div>
            ) : (
              <p className={styles.hint}>Loading cost preview…</p>
            )}
          </div>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              Price per seat ({offerCurrency}, legal cap enforced)
            </span>
            <input
              type="text"
              inputMode="decimal"
              className={styles.mono}
              value={priceText}
              disabled={!cost}
              onChange={(e) => {
                const text = e.target.value;
                setPriceText(text);
                const minor = majorTextToMinor(text);
                setPricePaise(minor);
                setCapError(minor !== null && maxCap !== null && minor > maxCap);
              }}
            />
          </label>
          {cost && pricePaise === null ? (
            <p className={styles.capError}>Enter a price, for example 12.50.</p>
          ) : null}
          {cost ? (
            <div className={styles.chipRow}>
              <button
                type="button"
                className={styles.chip}
                onClick={() => {
                  setPricePaise(cost.max_per_seat.amount_paise);
                  setPriceText(minorToMajorText(cost.max_per_seat.amount_paise));
                  setCapError(false);
                }}
              >
                Use the max
              </button>
            </div>
          ) : null}
          {capError ? (
            <p className={styles.capError}>
              You can ask for less, never more — max{" "}
              {cost ? showOfferPrice(cost.max_per_seat) : "—"}
            </p>
          ) : null}
          {selectedRoute && !selectedRoute.isEligible ? (
            <div className={styles.routeWarnBanner} role="alert">
              SeatShare supports road trips up to {SEATSHARE_MAX_DISTANCE_MILES} miles.
            </div>
          ) : null}
          <div className={styles.reassure}>
            Rovvy takes nothing and moves no money — settle directly with your rider.
          </div>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Pickup note for riders</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Exact pickup spot, luggage, flexible stops…"
            />
          </label>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <h2 className={`${styles.wizardTitle} ${styles.serif}`}>Review your ride</h2>
          <p className={styles.hint}>This is what riders will see. Check it, then publish.</p>
          <div className={styles.costBreakdown}>
            <div className={styles.costRow}>
              <span>From</span>
              <span>{from.address}</span>
            </div>
            <div className={styles.costRow}>
              <span>To</span>
              <span>{to.address}</span>
            </div>
            <div className={styles.costRow}>
              <span>Route</span>
              <span className={styles.mono}>
                {selectedRoute
                  ? `${selectedRoute.label} · ${selectedRoute.distanceMiles} mi · ${selectedRoute.durationMinutes} min`
                  : "—"}
              </span>
            </div>
            <div className={styles.costRow}>
              <span>Vehicle</span>
              <span>{vehicleDisplayLabel(vehicleType)}</span>
            </div>
            <div className={styles.costRow}>
              <span>Departs</span>
              <span className={styles.mono}>{departureLabel}</span>
            </div>
            <div className={styles.costRow}>
              <span>Seats</span>
              <span className={styles.mono}>{seatsOffered}</span>
            </div>
            <div className={styles.costRow}>
              <span>Booking</span>
              <span>{approval === "instant" ? "Confirms at once" : "Driver approves"}</span>
            </div>
            <div className={styles.costRow}>
              <span>Price per seat</span>
              <span className={`${styles.mono} ${styles.accentText}`}>
                {pricePaise !== null ? showOfferMoney(pricePaise) : "—"}
              </span>
            </div>
            {note ? (
              <div className={styles.costRow}>
                <span>Pickup note</span>
                <span>{note}</span>
              </div>
            ) : null}
          </div>
          <div className={styles.reassure}>
            Rovvy takes nothing and moves no money — settle directly with your rider.
          </div>
        </>
      ) : null}

      <div className={styles.wizardFooter}>
        {step > 1 ? (
          <button type="button" className={styles.wizardBack} onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
        ) : (
          <span />
        )}
        {step < TOTAL_STEPS ? (
          <button
            type="button"
            className={styles.ctaBook}
            disabled={
              step === 1
                ? !step1Ready
                : step === 2
                  ? !departureOk
                  : !priceValid || capError || !selectedRoute?.isEligible
            }
            onClick={() => setStep((s) => s + 1)}
          >
            Next
          </button>
        ) : (
          <>
            {publishError ? (
              <p className={styles.inlineError} role="alert">
                {publishError}
              </p>
            ) : null}
            <button
              type="button"
              className={styles.ctaBook}
              disabled={publishDisabled}
              onClick={() => void publish()}
            >
              {publishing ? "Publishing…" : "Publish the ride"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
