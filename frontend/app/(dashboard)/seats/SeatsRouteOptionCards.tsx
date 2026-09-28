"use client";

import {
  formatRouteDistance,
  formatRouteDuration,
  SEATSHARE_MAX_DISTANCE_MILES,
  type RouteOption,
} from "./seats-route";
import styles from "./seats.module.css";

type Props = {
  options: RouteOption[];
  selectedRouteId: string | null;
  onSelectRouteId: (id: string) => void;
};

export function SeatsRouteOptionCards({ options, selectedRouteId, onSelectRouteId }: Props) {
  if (options.length === 0) return null;

  return (
    <ul className={styles.routeOptionList}>
      {options.map((opt) => {
        const active = opt.id === (selectedRouteId ?? options[0]?.id);
        return (
          <li key={opt.id}>
            <button
              type="button"
              className={`${styles.routeOptionCard} ${active ? styles.routeOptionCardActive : ""}`}
              onClick={() => onSelectRouteId(opt.id)}
            >
              <span className={styles.routeOptionLabel}>{opt.label}</span>
              <span className={`${styles.routeOptionMeta} ${styles.mono}`}>
                {formatRouteDistance(opt.distanceMiles)} · {formatRouteDuration(opt.durationMinutes)}
              </span>
              {!opt.isEligible ? (
                <span className={styles.routeOptionOver}>Over {SEATSHARE_MAX_DISTANCE_MILES} mi limit</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
