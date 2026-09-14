"use client";

import type { ExploreAskCard as ExploreAskCardType } from "../explore-fixtures";
import styles from "../explore.module.css";

type ExploreAskCardProps = {
  card: ExploreAskCardType;
  onClick: (prompt: string) => void;
};

function AskIcon({ icon }: { icon?: ExploreAskCardType["icon"] }) {
  if (icon === "people") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="9.5" cy="8" r="3.4" />
        <path d="M3.5 20a6 6 0 0112 0M18 7.5v5M15.5 10h5" />
      </svg>
    );
  }
  if (icon === "weather") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M7 16.5a4.5 4.5 0 011-8.9 5.5 5.5 0 0110.4 1.9A3.8 3.8 0 0117.5 16.5z" />
        <path d="M9 20l-1 1.5M13 20l-1 1.5M17 20l-1 1.5" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    </svg>
  );
}

export function ExploreAskCard({ card, onClick }: ExploreAskCardProps) {
  const variantClass =
    card.variant === "primary"
      ? styles.askCardPrimary
      : card.variant === "cream"
        ? styles.askCardCream
        : styles.askCardOutline;

  return (
    <button type="button" className={`${styles.askCard} ${variantClass}`} onClick={() => onClick(card.prompt)}>
      <span className={styles.askCardLabel}>
        <AskIcon icon={card.icon} />
        Ask Rovvy
      </span>
      <span className={styles.askCardPrompt}>{card.prompt}</span>
      <span className={styles.askCardSubtitle}>
        {card.subtitle} <span aria-hidden>→</span>
      </span>
    </button>
  );
}
