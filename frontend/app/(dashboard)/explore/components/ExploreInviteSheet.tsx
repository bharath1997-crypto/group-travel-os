"use client";

import { useMemo, useState } from "react";
import { EXPLORE_INVITE_FRIENDS } from "../explore-fixtures";
import styles from "../explore.module.css";

type ExploreInviteSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function ExploreInviteSheet({ open, onClose }: ExploreInviteSheetProps) {
  const [guests, setGuests] = useState({ ana: true, tomas: false, sam: false });
  const [cta, setCta] = useState("Send invitations");
  const picked = useMemo(() => Object.values(guests).filter(Boolean).length, [guests]);

  if (!open) return null;

  const inviteCta =
    picked === 0 ? "Pick at least one person" : picked === 1 ? "Send 1 invitation" : `Send ${picked} invitations`;

  return (
    <div className={styles.sheetOverlay} onClick={onClose} role="presentation">
      <div className={styles.sheetPanel} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Invite friends">
        <div className={styles.sheetHeader}>
          <div>
            <div className={styles.sheetEyebrow}>Invite · no trip required</div>
            <h2 className={styles.sheetTitle}>Who&apos;s coming?</h2>
          </div>
          <button type="button" className={styles.sheetClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className={styles.sheetList}>
          {EXPLORE_INVITE_FRIENDS.map((friend, index) => {
            const key = ["ana", "tomas", "sam"][index] as keyof typeof guests;
            return (
              <label key={friend.initials} className={styles.sheetGuest}>
                <input
                  type="checkbox"
                  checked={guests[key]}
                  onChange={() => setGuests((prev) => ({ ...prev, [key]: !prev[key] }))}
                />
                <span className={`${styles.avatar} ${styles[`avatar${friend.tone.charAt(0).toUpperCase()}${friend.tone.slice(1)}`]}`}>
                  {friend.initials}
                </span>
                <span>
                  <span className={styles.sheetGuestName}>{friend.name}</span>
                  <span className={styles.sheetGuestNote}>{friend.note}</span>
                </span>
              </label>
            );
          })}
          <button type="button" className={styles.sheetShareLink}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Share a link instead
          </button>
        </div>
        <div className={styles.sheetSectionLabel}>How firm is it?</div>
        <div className={styles.sheetKindRow}>
          <button type="button" className={`${styles.filterChip} ${styles.filterChipOn}`}>
            Hold · yes / no
          </button>
          <button type="button" className={styles.filterChip}>
            Commit · they owe
          </button>
          <button type="button" className={styles.filterChip}>
            Open · first come
          </button>
        </div>
        <div className={styles.sheetRsvp}>
          <span>
            RSVP closes <strong>Thursday 8 PM</strong> — majority wins, no chasing.
          </span>
          <button type="button" className={styles.sheetRsvpBtn}>
            Change
          </button>
        </div>
        <button
          type="button"
          className={styles.sheetSubmit}
          onClick={() => {
            if (picked > 0) setCta("Invitations sent ✓");
          }}
        >
          {cta === "Send invitations" ? inviteCta : cta}
        </button>
      </div>
    </div>
  );
}
