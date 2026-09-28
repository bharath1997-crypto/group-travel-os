import styles from "./seats.module.css";

type Props = {
  eyebrow: string;
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export function SeatsFlowSuccess({
  eyebrow,
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: Props) {
  return (
    <div className={styles.flowSuccess} role="status">
      <p className={`${styles.flowSuccessEyebrow} ${styles.mono}`}>{eyebrow}</p>
      <h2 className={`${styles.flowSuccessTitle} ${styles.serif}`}>{title}</h2>
      <p className={styles.flowSuccessBody}>{body}</p>
      <div className={styles.flowSuccessActions}>
        <button type="button" className={styles.ctaBook} onClick={onPrimary}>
          {primaryLabel}
        </button>
        {secondaryLabel && onSecondary ? (
          <button type="button" className={styles.wizardBack} onClick={onSecondary}>
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
