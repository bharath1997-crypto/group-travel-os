import styles from "./seats.module.css";

type Props = {
  timeLabel: string;
  onWatch: () => void;
  watchDisabled: boolean;
  watchDisabledTitle?: string;
  watching: boolean;
  watchError: string | null;
  variant?: "empty" | "auth" | "error";
  errorMessage?: string | null;
  onSignIn?: () => void;
};

export function SeatsFindEmptyState({
  timeLabel,
  onWatch,
  watchDisabled,
  watchDisabledTitle,
  watching,
  watchError,
  variant = "empty",
  errorMessage,
  onSignIn,
}: Props) {
  if (variant === "auth") {
    return (
      <div className={styles.findEmpty} role="status">
        <p className={`${styles.findEmptyEyebrow} ${styles.mono}`}>SIGN IN</p>
        <h2 className={`${styles.findEmptyTitle} ${styles.serif}`}>Log in to search seats</h2>
        <p className={styles.findEmptyBody}>
          Seat listings are visible only to signed-in members. Log in to see real trips on this
          corridor.
        </p>
        <button type="button" className={styles.alertBtn} onClick={onSignIn}>
          Log in
        </button>
      </div>
    );
  }

  if (variant === "error") {
    return (
      <div className={styles.findEmpty} role="alert">
        <p className={`${styles.findEmptyEyebrow} ${styles.mono}`}>LISTINGS UNAVAILABLE</p>
        <h2 className={`${styles.findEmptyTitle} ${styles.serif}`}>Could not load seats</h2>
        <p className={styles.findEmptyBody}>
          {errorMessage ?? "Something went wrong loading listings for this route. Try again in a moment."}
        </p>
        <button
          type="button"
          className={styles.alertBtn}
          onClick={onWatch}
          disabled={watchDisabled}
          title={watchDisabledTitle}
        >
          Retry search
        </button>
      </div>
    );
  }

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
