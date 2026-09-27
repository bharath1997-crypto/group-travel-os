"use client";



import { useMemo, useState } from "react";

import type { ExploreSlotDetail } from "../explore-fixtures";

import { openExploreListingUrl } from "../explore-open-listing";

import styles from "../explore.module.css";



type ExploreSavedBarProps = {

  savedIds: string[];

  slotLookup: (id: string) => ExploreSlotDetail | null;

  onClear: () => void;

};



export function ExploreSavedBar({ savedIds, slotLookup, onClear }: ExploreSavedBarProps) {

  const [party, setParty] = useState(6);

  const [expanded, setExpanded] = useState(false);



  const { perPersonKnown, perPersonSum, firstBookableUrl } = useMemo(() => {

    let sum = 0;

    let unknown = false;

    let bookUrl: string | null = null;

    for (const id of savedIds) {

      const d = slotLookup(id);

      if (!d) {

        unknown = true;

        continue;

      }

      if (!bookUrl && d.sourceUrl && !d.editorial) bookUrl = d.sourceUrl;

      if (d.priceKnown === false && d.amount <= 0) {

        unknown = true;

        continue;

      }

      sum += d.amount ?? 0;

    }

    return { perPersonKnown: !unknown, perPersonSum: sum, firstBookableUrl: bookUrl };

  }, [savedIds, slotLookup]);



  if (!savedIds.length) return null;



  const savedLabel = savedIds.length === 1 ? "1 slot saved" : `${savedIds.length} slots saved`;

  const eachLine = perPersonKnown ? `$${perPersonSum} each` : "Price unknown for some picks";

  const groupLine =

    !perPersonKnown

      ? "Totals use known prices only — verify on the provider"

      : perPersonSum === 0

        ? "Saved for planning — open provider for prices"

        : party === 1

          ? `$${perPersonSum} total — yours alone`

          : `$${perPersonSum * party} estimated (${party} people)`;



  return (

    <div className={styles.savedBarWrap} data-saved-expanded={expanded}>

      <div className={`${styles.savedBar} ${expanded ? styles.savedBarExpanded : ""}`}>

        <button
          type="button"
          className={styles.savedBarMobileToggle}
          aria-expanded={expanded}
          aria-label={`${savedLabel}, ${eachLine}. ${expanded ? "Hide" : "Show"} saved controls`}
          onClick={() => setExpanded((value) => !value)}
        >
          <span>{savedLabel} · {eachLine}</span>
          <span aria-hidden="true">{expanded ? "−" : "+"}</span>
        </button>

        <div className={styles.savedBarCopy}>

          <div className={styles.savedBarEyebrow}>

            {savedLabel} · {eachLine}

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

          <button

            type="button"

            className={styles.savedBarBook}

            disabled={!firstBookableUrl}

            title={firstBookableUrl ? "Open first saved listing on provider" : "No booking link in saved picks"}

            onClick={() => openExploreListingUrl(firstBookableUrl)}

          >

            {firstBookableUrl ? "Open provider" : "No booking link"}

          </button>

          <button type="button" className={styles.savedBarClear} onClick={onClear}>

            Clear

          </button>

        </div>

      </div>

    </div>

  );

}

