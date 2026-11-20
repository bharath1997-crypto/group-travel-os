"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OFFER_TOUR_STEPS, type OfferTourStep } from "./seats-offer-tour";
import styles from "./seats.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Steps to show. Defaults to the Offer a ride demo. */
  steps?: OfferTourStep[];
  /** Eyebrow text before "demo N of M". */
  label?: string;
  /** Text of the last button. */
  finishLabel?: string;
};

/** Step-by-step demo dialog shared by Offer a ride and Find a seat. */
export function SeatsOfferTour({
  open,
  onClose,
  steps = OFFER_TOUR_STEPS,
  label = "Offer a ride",
  finishLabel = "Start offering a ride",
}: Props) {
  const [index, setIndex] = useState(0);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const total = steps.length;
  const step = steps[Math.min(index, total - 1)];
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
      aria-labelledby={titleId}
    >
      <div className={`${styles.mapModal} ${styles.tourModal}`}>
        <div className={styles.mapModalHead}>
          <p className={`${styles.eyebrow} ${styles.mono}`}>
            {label} · demo {index + 1} of {total}
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
          <h2 id={titleId} className={`${styles.wizardTitle} ${styles.serif}`}>
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
          {steps.map((s, i) => (
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
            {last ? finishLabel : "Next"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
