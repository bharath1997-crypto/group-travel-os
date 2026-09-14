"use client";

import { useState } from "react";
import type { ExploreSlotDetail } from "../explore-fixtures";
import { EXPLORE_DETAIL_GUESTS } from "../explore-fixtures";
import styles from "../explore.module.css";

type ExploreDetailDrawerProps = {
  detail: ExploreSlotDetail | null;
  onClose: () => void;
  onSave: (id: string) => void;
  onInvite: () => void;
};

export function ExploreDetailDrawer({ detail, onClose, onSave, onInvite }: ExploreDetailDrawerProps) {
  const [shareLabel, setShareLabel] = useState("Drop it in the group chat");
  const [bookLabel, setBookLabel] = useState<string | null>(null);

  if (!detail) return null;

  return (
    <div className={styles.drawerOverlay} onClick={onClose} role="presentation">
      <aside
        className={styles.drawerPanel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={detail.title}
      >
        <div className={styles.drawerHero}>
          <span className={styles.drawerHeroLabel}>detail photo 1040×460</span>
          <button type="button" className={styles.drawerClose} onClick={onClose} aria-label="Close">
            ×
          </button>
          <span className={styles.drawerSource}>{detail.source}</span>
          <div className={styles.drawerHeroCopy}>
            <span className={styles.slotMeta}>{detail.meta}</span>
            <h2 className={styles.drawerTitle}>{detail.title}</h2>
          </div>
        </div>
        <div className={styles.drawerContent}>
          <div className={styles.drawerPriceRow}>
            <span className={styles.drawerPrice}>{detail.price}</span>
            <span className={styles.drawerPriceNote}>{detail.note}</span>
            <span className={styles.drawerRating}>{detail.rating}</span>
          </div>
          <p className={styles.drawerBody}>{detail.body}</p>
          <div className={styles.drawerTags}>
            {detail.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <div className={styles.drawerMap}>
            <span>map · {detail.area}</span>
            <span className={styles.drawerMapDot} aria-hidden />
          </div>
          <div className={styles.drawerSectionLabel}>Who&apos;s going</div>
          <div className={styles.drawerGuests}>
            {EXPLORE_DETAIL_GUESTS.map((guest) => (
              <div key={guest.initials} className={styles.drawerGuestRow}>
                <span className={`${styles.avatar} ${styles[`avatar${guest.tone.charAt(0).toUpperCase()}${guest.tone.slice(1)}`]}`}>
                  {guest.initials}
                </span>
                <span className={styles.drawerGuestName}>{guest.name}</span>
                {guest.status ? (
                  <span className={guest.statusTone === "accent" ? styles.slotReason : styles.rankAvailabilityMuted}>
                    {guest.status}
                  </span>
                ) : null}
              </div>
            ))}
            <div className={styles.drawerGuestRow}>
              <span className={`${styles.avatar} ${styles.avatarNeutral}`}>+9</span>
              <span className={styles.drawerGuestExtra}>nine others from Rovvy</span>
            </div>
          </div>
          <div className={styles.drawerQuote}>
            <strong>Tomas:</strong> &ldquo;Get there by 8:40 or you&apos;re standing by the door.&rdquo;
          </div>
          <button type="button" className={styles.drawerShare} onClick={() => setShareLabel("Sent to the group chat ✓")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12v6.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V12" />
              <path d="M12 15.5V4M8 7.5L12 3.5l4 4" />
            </svg>
            {shareLabel}
          </button>
          <div className={styles.drawerActions}>
            <button
              type="button"
              className={styles.drawerBook}
              onClick={() => setBookLabel("Opening checkout…")}
            >
              {bookLabel ?? `Book · ${detail.price}`}
            </button>
            <button type="button" className={styles.drawerInvite} onClick={onInvite}>
              Invite friends
            </button>
            <button type="button" className={styles.drawerSave} onClick={() => onSave(detail.id)} aria-label="Save">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 3.5h12v17l-6-3.4-6 3.4z" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
