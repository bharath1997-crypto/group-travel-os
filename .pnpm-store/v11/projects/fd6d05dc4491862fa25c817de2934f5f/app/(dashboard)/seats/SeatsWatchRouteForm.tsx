"use client";

import { useState } from "react";
import { createRouteWatch } from "./seats-api";
import { isSeatsAuthError } from "./seats-api-errors";
import { SeatsLocationPicker, PROMPT_FROM, PROMPT_TO } from "./SeatsLocationPicker";
import { areSeatShareEndpointsReady, type LocationPoint } from "./seats-location";
import styles from "./seats-notify-bell.module.css";

type Props = {
  onSaved: () => void | Promise<void>;
  onAuthRequired: () => void;
};

export function SeatsWatchRouteForm({ onSaved, onAuthRequired }: Props) {
  const [from, setFrom] = useState<LocationPoint>(PROMPT_FROM);
  const [to, setTo] = useState<LocationPoint>(PROMPT_TO);
  const [seats, setSeats] = useState(1);
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const ready = areSeatShareEndpointsReady(from, to);

  async function save() {
    if (!ready) {
      setFormError("Confirm both locations on the map or search.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await createRouteWatch({
        from_lat: from.lat,
        from_lon: from.lng,
        to_lat: to.lat,
        to_lon: to.lng,
        from_label: from.address || null,
        to_label: to.address || null,
        date_from: date || undefined,
        seats,
      });
      await onSaved();
      setFrom(PROMPT_FROM);
      setTo(PROMPT_TO);
      setDate("");
      setSeats(1);
    } catch (e) {
      if (isSeatsAuthError(e)) {
        onAuthRequired();
        setFormError("Log in to save this alert.");
      } else {
        setFormError("Could not save corridor alert.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.formBox}>
      <SeatsLocationPicker
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        layout="wizard"
      />
      <div className={styles.formRow}>
        <label className={styles.formField}>
          <span>Leaving from (optional)</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className={styles.formField}>
          <span>Seats needed</span>
          <input
            type="number"
            min={1}
            max={4}
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
          />
        </label>
      </div>
      {formError ? (
        <p className={styles.panelError} role="alert">
          {formError}
        </p>
      ) : null}
      <button
        type="button"
        className={styles.saveBtn}
        disabled={!ready || saving}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Save corridor alert"}
      </button>
    </div>
  );
}
