"use client";

import type { ExploreSlotCard as ExploreSlotCardType } from "../explore-fixtures";
import { ExploreAvatarStack } from "./ExploreAvatarStack";
import { ExploreProviderBadge } from "./ExploreProviderBadge";
import styles from "../explore.module.css";

type ExploreSlotCardProps = {
  slot: ExploreSlotCardType;
  onOpen: (id: string) => void;
};

export function ExploreSlotCard({ slot, onOpen }: ExploreSlotCardProps) {
  return (
    <button type="button" className={styles.slotCard} onClick={() => onOpen(slot.id)}>
      <span className={styles.slotMedia} style={{ height: slot.imageHeight }}>
        <span className={styles.slotMediaLabel}>{slot.imageLabel}</span>
        {!slot.overlayTitle ? <ExploreProviderBadge label={slot.source} variant="dark" /> : null}
        {slot.badge ? (
          <ExploreProviderBadge
            label={slot.badge}
            variant={slot.badgeVariant ?? "neutral"}
            align={slot.overlayTitle ? "left" : "right"}
          />
        ) : null}
        {slot.overlayTitle ? (
          <span className={styles.slotOverlayTitle}>
            <span className={styles.slotMeta}>{slot.meta}</span>
            <span className={styles.slotOverlayHeading}>{slot.title}</span>
          </span>
        ) : null}
        {slot.friendsGoing ? (
          <span className={styles.slotFriendsPill}>
            <ExploreAvatarStack
              size="sm"
              people={[
                { initials: "TK", tone: "purple" },
                { initials: "AR", tone: "gold" },
              ]}
            />
            <span>{slot.friendsGoing} friends going</span>
          </span>
        ) : null}
      </span>
      {!slot.overlayTitle ? (
        <span className={styles.slotBody}>
          <span className={styles.slotMeta}>{slot.meta}</span>
          <span className={styles.slotTitle}>{slot.title}</span>
          {slot.summary ? <span className={styles.slotSummary}>{slot.summary}</span> : null}
          {slot.reason ? <span className={styles.slotReason}>{slot.reason}</span> : null}
          <span className={styles.slotFooter}>
            <span className={styles.slotPrice}>{slot.price}</span>
            <span className={styles.slotNote}>{slot.note}</span>
            <span className={styles.slotRating}>{slot.rating}</span>
          </span>
        </span>
      ) : (
        <span className={styles.slotBody}>
          {slot.summary ? <span className={styles.slotSummary}>{slot.summary}</span> : null}
          <span className={styles.slotFooter}>
            <span className={styles.slotPrice}>{slot.price}</span>
            <span className={styles.slotNote}>{slot.note}</span>
            <span className={styles.slotRating}>{slot.rating}</span>
          </span>
        </span>
      )}
    </button>
  );
}
