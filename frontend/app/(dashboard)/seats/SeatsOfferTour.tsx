"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OFFER_TOUR_STEPS } from "./seats-offer-tour";
import styles from "./seats.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SeatsOfferTour({ open, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const total = OFFER_TOUR_STEPS.length;
  const step = OFFER_TOUR_STEPS[index];
  const last = index === total - 1;

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    primaryRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, total - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, total]);

  // Render into <body>: the dashboard page transition uses a CSS transform, which would
  // otherwise trap this fixed overlay inside the page instead of centring it on screen.
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={styles.mapModalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-tour-title"
    >
      <div className={`${styles.mapModal} ${styles.tourModal}`}>
        <div className={styles.mapModalHead}>
          <p className={`${styles.eyebrow} ${styles.mono}`}>
            Offer a ride · demo {index + 1} of {total}
          </p>
          <button
            type="button"
            className={styles.mapModalClose}
            onClick={onClose}
            aria-label="Close demo"
          >
            <X size={18} />
          </button>
        </div>
        <div className={styles.tourBody}>
          <h2 id="offer-tour-title" className={`${styles.wizardTitle} ${styles.serif}`}>
            {step.title}
          </h2>
          <p className={styles.hint}>{step.body}</p>
          <ul className={styles.tourPoints}>
            {step.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <div className={styles.tourDots} aria-hidden>
          {OFFER_TOUR_STEPS.map((s, i) => (
            <span key={s.id} className={i === index ? styles.wizardSegOn : styles.wizardSeg} />
          ))}
        </div>
        <div className={`${styles.wizardFooter} ${styles.tourFooter}`}>
          {index === 0 ? (
            <button type="button" className={styles.wizardBack} onClick={onClose}>
              Skip
            </button>
          ) : (
            <button type="button" className={styles.wizardBack} onClick={() => setIndex(index - 1)}>
              Back
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            className={styles.ctaBook}
            onClick={() => (last ? onClose() : setIndex(index + 1))}
          >
            {last ? "Start offering a ride" : "Next"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
