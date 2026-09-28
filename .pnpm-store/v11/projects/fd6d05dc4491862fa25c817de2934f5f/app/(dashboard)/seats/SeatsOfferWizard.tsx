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
  const [departTime, setDepartTime] = useState("05:30");
  const [seatsOffered, setSeatsOffered] = useState(3);
  const [approval, setApproval] = useState<"instant" | "manual">("instant");
  const [pricePaise, setPricePaise] = useState(47000);
  const [note, setNote] = useState("");
  const [cost, setCost] = useState<CostPreview | null>(null);
  const [capError, setCapError] = useState(false);
  const [publishing, setPublishing] = useState(false);

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

  useEffect(() => {
    if (step !== 3) return;
    let cancelled = false;
    (async () => {
      try {
        const preview = await previewRideCost({
          stops,
          mileage_kmpl: SEATSHARE_VEHICLE_TYPES.find((v) => v.id === vehicleType)?.mileageKmpl ?? 15,
          seats_offered: seatsOffered,
          tolls_paise: null,
        });
        if (!cancelled) {
          setCost(preview);
          setPricePaise(preview.max_per_seat.amount_paise);
          setCapError(false);
        }
      } catch {
        /* demo offline */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, stops, seatsOffered, vehicleType]);

  const maxCap = cost?.max_per_seat.amount_paise ?? pricePaise;

  const step1Ready = routeReady && Boolean(vehicleType);

  async function publish() {
    if (!selectedRoute || !selectedRoute.isEligible) return;
    if (pricePaise > maxCap) {
      setCapError(true);
      return;
    }
    setPublishing(true);
    setPublishError(null);
    const depart_at = new Date(`${departDate}T${departTime}:00+05:30`).toISOString();
    const arrive = new Date(`${departDate}T${departTime}:00+05:30`);
    arrive.setMinutes(arrive.getMinutes() + selectedRoute.durationMinutes);
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
      setStep(1);
      setFrom(PROMPT_FROM);
      setTo(PROMPT_TO);
      setNote("");
      setDepartDate("");
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
    publishing || capError || !selectedRoute?.isEligible || !departDate;

  return (
    <div className={styles.wizard}>
      <div className={styles.wizardProgress}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={n <= step ? styles.wizardSegOn : styles.wizardSeg} />
        ))}
      </div>
      <p className={`${styles.eyebrow} ${styles.mono}`}>Offer a ride · step {step} of 3</p>

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
              <input type="date" value={departDate} onChange={(e) => setDepartDate(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Time</span>
              <input type="time" value={departTime} onChange={(e) => setDepartTime(e.target.value)} />
            </label>
          </div>
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
                  <span className={styles.mono}>{showOfferPrice(cost.cost_total)}</span>
                </div>
                <div className={styles.costRow}>
                  <span>Split {seatsOffered + 1} ways</span>
                  <span className={`${styles.mono} ${styles.accentText}`}>
                    {showOfferPrice(cost.max_per_seat)} max
                  </span>
                </div>
              </>
            ) : (
              <p className={styles.hint}>Loading cost preview…</p>
            )}
          </div>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              Price per seat ({offerCurrency}, legal cap enforced)
            </span>
            <input
              type="number"
              className={styles.mono}
              value={pricePaise}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPricePaise(v);
                setCapError(v > maxCap);
              }}
            />
          </label>
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

      <div className={styles.wizardFooter}>
        {step > 1 ? (
          <button type="button" className={styles.wizardBack} onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <button
            type="button"
            className={styles.ctaBook}
            disabled={step === 1 ? !step1Ready : step === 2 ? !departDate : false}
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
