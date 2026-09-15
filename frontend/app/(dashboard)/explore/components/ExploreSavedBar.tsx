"use client";

import { useMemo, useState } from "react";
import { slotDetail } from "../explore-fixtures";
import styles from "../explore.module.css";

type ExploreSavedBarProps = {
  savedIds: string[];
  onClear: () => void;
  onInvite: () => void;
};

export function ExploreSavedBar({ savedIds, onClear, onInvite }: ExploreSavedBarProps) {
  const [party, setParty] = useState(6);
  const [bookLabel, setBookLabel] = useState("Book");
  const [splitLabel, setSplitLabel] = useState("Split");

  const total = useMemo(
    () => savedIds.reduce((sum, id) => sum + (slotDetail(id)?.amount ?? 0), 0),
    [savedIds],
  );

  if (!savedIds.length) return null;

  const savedLabel = savedIds.length === 1 ? "1 slot saved" : `${savedIds.length} slots saved`;
  const groupLine =
    total === 0
      ? "Book it, bring people, split the cost"
      : party === 1
        ? `$${total} total — yours alone`
        : `$${total * party} total, split ${party} ways`;

  return (
    <div className={styles.savedBarWrap}>
      <div className={styles.savedBar}>
        <div className={styles.savedBarCopy}>
          <div className={styles.savedBarEyebrow}>
            {savedLabel} · ${total} each
          </div>
          <div className={styles.savedBarLine}>{groupLine}</div>
        </div>
        <div className={styles.savedBarStepper}>
          <button type="button" onClick={() => setParty((p) => Math.max(1, p - 1))} aria-label="Decrease party size">
            −
          </button>
          <span>{party === 1 ? "just me" : `${party} people`}</span>
          <button type="button" onClick={() => setParty((p) => Math.min(16, p + 1))} aria-label="Increase party size">
            +
          </button>
        </div>
        <div className={styles.savedBarActions}>
          <button type="button" className={styles.savedBarBook} onClick={() => setBookLabel("Opening checkout…")}>
            {bookLabel}
          </button>
          <button type="button" className={styles.savedBarGhost} onClick={onInvite}>
            Invite
          </button>
          <button type="button" className={styles.savedBarGhost} onClick={() => setSplitLabel("Sent to Splits ✓")}>
            {splitLabel}
          </button>
          <button type="button" className={styles.savedBarClear} onClick={onClear}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
