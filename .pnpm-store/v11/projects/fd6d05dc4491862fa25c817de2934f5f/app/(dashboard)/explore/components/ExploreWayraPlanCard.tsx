"use client";

import type { ExploreWayraPlan } from "../explore-fixtures";
import styles from "../explore.module.css";

type ExploreWayraPlanCardProps = {
  plan: ExploreWayraPlan;
};

export function ExploreWayraPlanCard({ plan }: ExploreWayraPlanCardProps) {
  return (
    <article className={`${styles.wayraPlanCard} ${plan.highlighted ? styles.wayraPlanCardHighlight : ""}`}>
      <header className={styles.wayraPlanHeader}>
        <span>{plan.tier}</span>
        <span>{plan.price}</span>
      </header>
      {plan.steps.map((step) =>
        step.connector ? (
          <p key={step.label} className={styles.wayraPlanConnector}>
            {step.label}
          </p>
        ) : (
          <div key={`${step.time}-${step.label}`} className={styles.wayraPlanStep}>
            <span>{step.time}</span>
            <span>{step.label}</span>
          </div>
        ),
      )}
      <button
        type="button"
        className={plan.highlighted ? styles.wayraPlanCtaPrimary : styles.wayraPlanCtaGhost}
        disabled
        title="Save plan to day / cart is not connected yet"
      >
        Take this night (save coming soon)
      </button>
    </article>
  );
}
