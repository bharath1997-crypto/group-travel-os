import styles from "./seats.module.css";

type Props = {
  timeLabel: string;
  onWatch: () => void;
  watchDisabled: boolean;
  watchDisabledTitle?: string;
  watching: boolean;
  watchError: string | null;
};

export function SeatsFindEmptyState({
  timeLabel,
  onWatch,
  watchDisabled,
  watchDisabledTitle,
  watching,
  watchError,
}: Props) {
  return (
    <div className={styles.findEmpty} role="status">
      <p className={`${styles.findEmptyEyebrow} ${styles.mono}`}>NO MATCHES</p>
      <h2 className={`${styles.findEmptyTitle} ${styles.serif}`}>
        No seats leaving around {timeLabel}
      </h2>
      <p className={styles.findEmptyBody}>
        Try a different time, loosen your route, or watch this corridor — we&apos;ll notify you when
        someone posts a trip that fits.
      </p>
      <button
        type="button"
        className={styles.alertBtn}
        onClick={onWatch}
        disabled={watchDisabled || watching}
        title={watchDisabledTitle}
      >
        {watching ? "Watching this route ✓" : "Watch this route"}
      </button>
      {watchError ? (
        <p className={styles.findEmptyError} role="alert">
          {watchError}
        </p>
      ) : null}
    </div>
  );
}
