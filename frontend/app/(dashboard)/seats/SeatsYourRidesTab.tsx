"use client";

import Link from "next/link";
import { useState } from "react";
import {
  cancelPublishedRide,
  decideBooking,
  editPublishedRide,
  type SeatsMe,
} from "./seats-api";
import { buildShareTripText, rideDetailChips } from "./seats-ride-details";
import { isSeatsAuthError } from "./seats-api-errors";
import { formatTimeIst } from "./seats-money";
import styles from "./seats.module.css";

type Props = {
  data: SeatsMe | null;
  loading?: boolean;
  authRequired?: boolean;
  loadError?: string | null;
  onRefresh: () => void;
  onAuthRequired?: () => void;
};

function routeLabel(stops: Array<{ label: string }>): string {
  return stops.map((s) => s.label).join(" → ");
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function personInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type DrivingRide = SeatsMe["driving"][number];

function DrivingRideTools({
  ride,
  onSaved,
  onAuthRequired,
}: {
  ride: DrivingRide;
  onSaved: () => void;
  onAuthRequired?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(ride.note ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const locked = ride.status !== "open" && ride.status !== "full";
  const stops = ride.stops ?? [];
  const chips = rideDetailChips(ride.preferences);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await editPublishedRide(ride.ride_id, { note: note.trim() });
      setEditing(false);
      onSaved();
    } catch (e: unknown) {
      if (isSeatsAuthError(e)) {
        onAuthRequired?.();
        setMsg("Log in to edit this ride.");
      } else {
        setMsg("Could not save. A ride that has left or been cancelled cannot be edited.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    const first = stops[0]?.label ?? "my start";
    const last = stops[stops.length - 1]?.label ?? "my destination";
    const car = ride.preferences
      ? [ride.preferences.vehicle_color, ride.preferences.vehicle_make, ride.preferences.vehicle_model]
          .filter(Boolean)
          .join(" ")
      : "";
    const text = buildShareTripText({
      from: first,
      to: last,
      departLabel: new Date(ride.depart_at).toLocaleString(),
      car: car || null,
      note: ride.note ?? null,
    });
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setMsg("Trip details copied. Paste them to someone you trust.");
    } catch {
      setMsg("Could not share from this browser.");
    }
  }

  return (
    <>
      {chips.length > 0 ? <p className={styles.rideLineMuted}>{chips.join(" · ")}</p> : null}
      {ride.note && !editing ? (
        <p className={styles.driverNote}>
          <span className={styles.pickupLabel}>Pickup:</span> {ride.note}
        </p>
      ) : null}
      {editing ? (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Pickup note for riders</span>
          <textarea value={note} rows={3} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        </label>
      ) : null}
      <div className={styles.cardActionRow}>
        {editing ? (
          <>
            <button type="button" className={styles.ctaAsk} onClick={() => setEditing(false)}>
              Discard
            </button>
            <button type="button" className={styles.ctaBook} disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save note"}
            </button>
          </>
        ) : (
          <>
            {!locked ? (
              <button type="button" className={styles.ctaAsk} onClick={() => setEditing(true)}>
                Edit note
              </button>
            ) : null}
            <button type="button" className={styles.ctaAsk} onClick={() => void share()}>
              Share trip
            </button>
          </>
        )}
      </div>
      {!locked ? (
        <p className={styles.hint}>
          Price, seats, route and time are locked once published; cancel and republish to change them.
        </p>
      ) : null}
      {msg ? (
        <p className={styles.hint} role="status">
          {msg}
        </p>
      ) : null}
    </>
  );
}

export function SeatsYourRidesTab({
  data,
  loading = false,
  authRequired = false,
  loadError = null,
  onRefresh,
  onAuthRequired,
}: Props) {
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading && !data) {
    return <p className={styles.hint}>Loading your rides…</p>;
  }

  if (authRequired) {
    return (
      <div className={styles.yoursEmpty}>
        <p className={`${styles.mono} ${styles.findEmptyEyebrow}`}>SIGN IN</p>
        <p className={styles.lede}>Log in to see rides you&apos;re driving, riding, or waiting on.</p>
        <button type="button" className={styles.alertBtn} onClick={() => onAuthRequired?.()}>
          Log in
        </button>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.yoursEmpty} role="alert">
        <p className={styles.lede}>{loadError}</p>
        <button type="button" className={styles.alertBtn} onClick={() => void onRefresh()}>
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return <p className={styles.hint}>Loading your rides…</p>;
  }

  async function handle(bookingId: string, action: "approve" | "decline" | "withdraw") {
    setActionError(null);
    try {
      await decideBooking(bookingId, action);
      onRefresh();
    } catch (e: unknown) {
      if (isSeatsAuthError(e)) {
        onAuthRequired?.();
        setActionError("Log in to manage this booking.");
        return;
      }
      setActionError("Could not update booking. Try again.");
    }
  }

  async function cancelRide(rideId: string) {
    setActionError(null);
    try {
      await cancelPublishedRide(rideId);
      onRefresh();
    } catch (e: unknown) {
      if (isSeatsAuthError(e)) {
        onAuthRequired?.();
        setActionError("Log in to cancel this listing.");
        return;
      }
      setActionError("Could not cancel this ride.");
    }
  }

  const hasUpcoming =
    data.pending_as_driver.length > 0 ||
    data.riding.length > 0 ||
    data.driving.length > 0;
  const hasHistory =
    (data.history_driving?.length ?? 0) > 0 || (data.history_riding?.length ?? 0) > 0;

  return (
    <div className={styles.yoursList}>
      {actionError ? (
        <p className={styles.inlineError} role="alert">
          {actionError}
        </p>
      ) : null}

      <section className={styles.yoursSection}>
        <h2 className={`${styles.yoursSectionTitle} ${styles.mono}`}>Upcoming</h2>

        {data.pending_as_driver.map((block) => (
          <article key={block.ride_id} className={styles.pendingCard}>
            <div className={styles.pendingHeader}>
              <span className={`${styles.mono} ${styles.pendingTitle}`}>
                {block.request_count} people asked to join
              </span>
              <span className={`${styles.mono} ${styles.departChip}`}>
                {formatTimeIst(block.depart_at)}
              </span>
            </div>
            <p className={styles.rideLine}>{routeLabel(block.stops)}</p>
            {block.requests.map((req) => (
              <div key={req.booking_id} className={styles.requestRow}>
                <div className={styles.driverHead}>
                  <span className={styles.avatar}>
                    {personInitials(req.rider.name)}
                  </span>
                  <div>
                    <div className={styles.driverName}>
                      {req.rider.name}
                      {req.rider.verified ? " ✓" : ""}
                    </div>
                    {!req.rider.verified ? (
                      <div className={styles.unverifiedMeta}>
                        New profile · no rides yet · not verified
                      </div>
                    ) : (
                      <div className={styles.unverifiedMeta}>
                        {req.seats} seat{req.seats === 1 ? "" : "s"} requested
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.requestActions}>
                  <button
                    type="button"
                    className={styles.ctaAsk}
                    onClick={() => void handle(req.booking_id, "decline")}
                  >
                    No
                  </button>
                  {req.rider.verified ? (
                    <button
                      type="button"
                      className={styles.ctaBook}
                      onClick={() => void handle(req.booking_id, "approve")}
                    >
                      Take them
                    </button>
                  ) : (
                    <Link href="/lounge" className={`${styles.ctaMessage} ${styles.mono}`}>
                      Message first
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </article>
        ))}

        {data.driving.map((d) => (
          <article key={d.ride_id} className={styles.ridingCard}>
            <span className={styles.ridingChip}>You&apos;re driving</span>
            <p className={`${styles.mono} ${styles.ridingDetail}`}>
              {formatTimeIst(d.depart_at)} · {d.seats_free} seats free
              {d.pending_count > 0 ? ` · ${d.pending_count} pending` : ""}
            </p>
            <p className={styles.rideLineMuted}>{statusLabel(d.status)}</p>
            <DrivingRideTools ride={d} onSaved={onRefresh} onAuthRequired={onAuthRequired} />
            <div className={styles.cardActionRow}>
              <button
                type="button"
                className={styles.ctaAsk}
                onClick={() => void cancelRide(d.ride_id)}
              >
                Cancel listing
              </button>
            </div>
          </article>
        ))}

        {data.riding.map((r) => (
          <article key={r.booking_id} className={styles.ridingCard}>
            <span className={styles.ridingChip}>You&apos;re riding</span>
            <p className={`${styles.mono} ${styles.ridingDetail}`}>
              {formatTimeIst(r.ride.depart_at)} · {routeLabel(r.ride.stops)}
            </p>
            <p className={styles.rideLineMuted}>{statusLabel(r.status)}</p>
            {r.driver ? (
              <div className={styles.ridingDriver}>
                <div className={styles.driverHead}>
                  <span className={styles.avatar}>
                    {personInitials(r.driver.name)}
                  </span>
                  <div>
                    <div className={styles.driverName}>
                      {r.driver.name}
                      {r.driver.verified ? " ✓" : ""}
                    </div>
                    <div className={styles.unverifiedMeta}>Driver</div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className={styles.ridingFooter}>
              <span>
                You owe {r.price_total.display} — Rovvy doesn&apos;t settle this; pay the driver
                directly.
              </span>
              <div className={styles.requestActions}>
                {r.status === "held" || r.status === "requested" || r.status === "confirmed" ? (
                  <button
                    type="button"
                    className={styles.ctaAsk}
                    onClick={() => void handle(r.booking_id, "withdraw")}
                  >
                    {r.status === "confirmed" ? "Cancel seat" : "Cancel request"}
                  </button>
                ) : null}
                <Link href="/lounge" className={styles.ctaAsk}>
                  Message
                </Link>
                <Link href="/split-activities" className={styles.ctaBook}>
                  Open in Splits
                </Link>
              </div>
            </div>
          </article>
        ))}

        {!hasUpcoming ? (
          <div className={styles.yoursEmpty}>
            <p className={styles.lede}>Book a seat or offer a ride to see it here.</p>
          </div>
        ) : null}
      </section>

      <section className={styles.yoursSection}>
        <h2 className={`${styles.yoursSectionTitle} ${styles.mono}`}>History</h2>

        {(data.history_riding ?? []).map((r) => (
          <article key={r.booking_id} className={styles.historyCard}>
            <div className={styles.historyHead}>
              <span className={`${styles.mono} ${styles.historyStatus}`}>{statusLabel(r.status)}</span>
              <span className={`${styles.mono} ${styles.historyTime}`}>
                {formatTimeIst(r.ride.depart_at)}
              </span>
            </div>
            <p className={styles.rideLineMuted}>{routeLabel(r.ride.stops)}</p>
            {r.driver ? (
              <p className={styles.historyPerson}>
                {r.driver.name} · {r.seats} seat{r.seats === 1 ? "" : "s"} · {r.price_total.display}
              </p>
            ) : null}
          </article>
        ))}

        {(data.history_driving ?? []).map((d) => (
          <article key={d.ride_id} className={styles.historyCard}>
            <div className={styles.historyHead}>
              <span className={`${styles.mono} ${styles.historyStatus}`}>
                Drove · {statusLabel(d.status)}
              </span>
              <span className={`${styles.mono} ${styles.historyTime}`}>
                {formatTimeIst(d.depart_at)}
              </span>
            </div>
            <p className={styles.rideLineMuted}>{routeLabel(d.stops)}</p>
          </article>
        ))}

        {!hasHistory ? (
          <div className={styles.yoursEmpty}>
            <p className={styles.lede}>Completed and cancelled rides show up here.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
