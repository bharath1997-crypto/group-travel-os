"use client";

import type { Friend } from "./collection-types";
import styles from "./collection.module.css";

type Props = {
  friends: Friend[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  /** The friends list could not be loaded (different from having no friends). */
  unavailable?: boolean;
};

/** The server accepts at most 20 friends per send. */
export const MAX_PICKED_FRIENDS = 20;

/** Tap friends to pick who gets a copy in their Unsorted. Only accepted connections are listed. */
export default function FriendPicker({ friends, selected, onChange, disabled, unavailable }: Props) {
  if (unavailable) {
    return <p className={styles.candidateHint}>Your friends could not be loaded. Reload the page to try again.</p>;
  }
  if (friends.length === 0) {
    return <p className={styles.candidateHint}>Add friends in Rovvy to send saves to them.</p>;
  }
  const toggle = (id: string) => {
    if (selected.includes(id)) return onChange(selected.filter((x) => x !== id));
    if (selected.length >= MAX_PICKED_FRIENDS) return;
    onChange([...selected, id]);
  };
  return (
    <div className={styles.friendPicker} role="group" aria-label="Send to friends">
      {friends.map((f) => (
        <button
          key={f.id}
          type="button"
          disabled={disabled}
          aria-pressed={selected.includes(f.id)}
          className={`${styles.chip} ${selected.includes(f.id) ? styles.chipActive : ""}`}
          onClick={() => toggle(f.id)}
        >
          {f.full_name}
        </button>
      ))}
    </div>
  );
}
