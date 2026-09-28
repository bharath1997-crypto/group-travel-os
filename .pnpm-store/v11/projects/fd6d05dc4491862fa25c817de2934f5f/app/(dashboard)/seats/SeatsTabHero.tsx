import styles from "./seats.module.css";

type Variant = "find" | "offer" | "yours";

const COPY: Record<
  Variant,
  { eyebrow: string; title: string; lede: string }
> = {
  find: {
    eyebrow: "SEATS",
    title: "Post or join a road trip",
    lede: "Choose your exact route and share available seats for trips up to 200 miles. Four-wheelers only.",
  },
  offer: {
    eyebrow: "OFFER",
    title: "Share empty seats on your drive",
    lede: "Confirm your road path, set a fair cost-share price, and publish to riders on your corridor.",
  },
  yours: {
    eyebrow: "YOUR TRIPS",
    title: "Rides you’re driving or joining",
    lede: "Approve requests, message your driver, and settle payment directly — Rovvy never moves money.",
  },
};

export function SeatsTabHero({ variant }: { variant: Variant }) {
  const copy = COPY[variant];
  return (
    <header className={styles.hero}>
      <p className={`${styles.eyebrow} ${styles.mono}`}>{copy.eyebrow}</p>
      <h1 className={`${styles.title} ${styles.serif}`}>{copy.title}</h1>
      <p className={styles.lede}>{copy.lede}</p>
    </header>
  );
}
