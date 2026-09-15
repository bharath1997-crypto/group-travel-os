"use client";

import type { ExploreFriend } from "../explore-fixtures";
import styles from "../explore.module.css";

const TONE_CLASS: Record<ExploreFriend["tone"], string> = {
  gold: styles.avatarGold,
  purple: styles.avatarPurple,
  green: styles.avatarGreen,
  neutral: styles.avatarNeutral,
};

type ExploreAvatarStackProps = {
  people: Pick<ExploreFriend, "initials" | "tone">[];
  size?: "sm" | "md" | "lg";
};

export function ExploreAvatarStack({ people, size = "md" }: ExploreAvatarStackProps) {
  return (
    <span className={`${styles.avatarStack} ${styles[`avatarStack${size.charAt(0).toUpperCase()}${size.slice(1)}`]}`}>
      {people.map((person) => (
        <span key={person.initials} className={`${styles.avatar} ${TONE_CLASS[person.tone]}`}>
          {person.initials}
        </span>
      ))}
    </span>
  );
}
