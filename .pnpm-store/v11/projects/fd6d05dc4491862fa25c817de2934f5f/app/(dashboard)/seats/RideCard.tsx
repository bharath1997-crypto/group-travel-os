"use client";

import { useState } from "react";
import type { SeatRideCard } from "./seats-api";
import { bookSeat } from "./seats-api";
import { isSeatsAuthError } from "./seats-api-errors";
import { formatTimeIst } from "./seats-money";
import { vehicleDisplayLabel } from "./seats-vehicle";
import styles from "./seats.module.css";

export type BookSuccessPayload = {
  rideId: string;
  status: string;
  instant: boolean;
  driverName: string;
};

type Props = {
  ride: SeatRideCard;
  seatsNeeded: number;
  onTaken: (rideId: string) => void;
  onBookSuccess: (payload: BookSuccessPayload) => void;
  onAuthRequired: () => void;
};

function SeatBlocks({ total, free }: { total: number; free: number }) {
  const taken = total - free;
  return (
    <div className={styles.seatBlocks} aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`${styles.seatBlock} ${i < taken ? styles.seatBlockTaken : styles.seatBlockFree}`}
        />
      ))}
    </div>
  );
}

export function RideCard({
  ride,
  seatsNeeded,
  onTaken,
  onBookSuccess,
  onAuthRequired,
}: Props) {
  const [pending, setPending] = useState(false);
  const [justTaken, setJustTaken] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);

  const board = ride.stops.find((s) => s.seq === ride.board_seq) ?? ride.stops[0];
  const alight =
    ride.stops.find((s) => s.seq === ride.alight_seq) ?? ride.stops[ride.stops.length - 1];

  const enough = ride.seats_free >= seatsNeeded;
  const instant = ride.approval === "instant";
  const vehicleLabel =
    ride.vehicle?.display ??
    (ride.vehicle?.make && ride.vehicle?.model
      ? `${ride.vehicle.make} ${ride.vehicle.model}`
      : vehicleDisplayLabel(ride.vehicle?.body_type));

  async function onBook() {
    if (!enough || pending || justTaken) return;
    setBookError(null);
    setPending(true);
    try {
      const res = await bookSeat(ride.id, {
        seats: seatsNeeded,
        board_seq: board?.seq ?? 0,
        alight_seq: alight?.seq ?? ride.stops.length - 1,
      });
      onBookSuccess({
        rideId: ride.id,
        status: res.status,
        instant,
        driverName: ride.driver.name,
      });
    } catch (e: unknown) {
      if (isSeatsAuthError(e)) {
        onAuthRequired();
        setBookError("Log in to book this seat.");
        return;
      }
      const status = (e as { status?: number })?.status;
      if (status === 409) {
        setJustTaken(true);
        onTaken(ride.id);
        setBookError("Someone else just took these seats.");
        return;
      }
      setBookError("Could not complete booking. Try again.");
    } finally {
      setPending(false);
    }
  }

  let ctaLabel = instant ? "Book it" : "Ask to join";
  let ctaClass = instant ? styles.ctaBook : styles.ctaAsk;
  let ctaHint = instant ? "Confirms at once" : "Driver approves";
  if (!enough) {
    ctaLabel = "Not enough seats";
    ctaClass = styles.ctaDisabled;
    ctaHint = `Try ${Math.min(ride.seats_free, 1)} seat`;
  } else if (justTaken) {
    ctaLabel = "Just taken";
    ctaClass = styles.ctaDisabled;
    ctaHint = "";
  }

  return (
    <article className={styles.card}>
      <div className={styles.routeCol}>
        <div className={styles.routeRail}>
          <span className={styles.routeDotStart} />
          <span className={styles.routeLine} />
          <span className={styles.routeDotEnd} />
        </div>
        <div>
          <div className={styles.routeTimes}>
            <div className={styles.routeTimeBlock}>
              <strong className={styles.mono}>{formatTimeIst(ride.depart_at)}</strong>
              <span>{board?.label ?? "—"}</span>
            </div>
            <div className={styles.routeTimeBlock}>
              <strong className={styles.mono}>
                {ride.arrive_est_at ? formatTimeIst(ride.arrive_est_at) : "—"}
              </strong>
              <span>{alight?.label ?? "—"}</span>
            </div>
          </div>
          {ride.route_summary ? (
            <p className={`${styles.routeSummary} ${styles.mono}`}>{ride.route_summary}</p>
          ) : null}
        </div>
      </div>

      <div className={styles.driverCol}>
        <div className={styles.driverHead}>
          <span
            className={`${styles.avatar} ${ride.driver.verified ? styles.avatarVerified : ""}`}
          >
            {ride.driver.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div>
            <div className={styles.driverName}>
              {ride.driver.name}
              {ride.driver.verified ? " ✓" : ""}
            </div>
            <div className={`${styles.driverMeta} ${styles.mono}`}>
              ★ {ride.driver.rating} · {ride.driver.ride_count ?? 0} rides
            </div>
            <div className={`${styles.vehicleMeta} ${styles.mono}`}>{vehicleLabel}</div>
          </div>
        </div>
        <SeatBlocks total={ride.seats_offered} free={ride.seats_free} />
        <div className={`${styles.seatFreeNote} ${styles.mono}`}>
          {ride.seats_free} seat{ride.seats_free === 1 ? "" : "s"} left · {ride.seats_offered} total
        </div>
        {ride.note ? (
          <p className={styles.driverNote}>
            <span className={styles.pickupLabel}>Pickup:</span> {ride.note}
          </p>
        ) : null}
      </div>

      <div className={styles.priceCol}>
        <div>
          <div className={`${styles.price} ${styles.mono}`}>{ride.price_per_seat.display}</div>
          <div className={`${styles.priceNote} ${styles.mono}`}>per seat · fuel & tolls</div>
        </div>
        <button
          type="button"
          className={`${styles.cta} ${ctaClass}`}
          disabled={!enough || pending || justTaken}
          onClick={onBook}
        >
          {pending ? "…" : ctaLabel}
        </button>
        {ctaHint ? (
          <span className={`${styles.ctaHint} ${styles.mono}`}>{ctaHint}</span>
        ) : null}
        {bookError ? (
          <p className={styles.inlineError} role="alert">
            {bookError}
          </p>
        ) : null}
      </div>
    </article>
  );
}
