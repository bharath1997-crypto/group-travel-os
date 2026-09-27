"use client";

import dynamic from "next/dynamic";
import { loadSeatsPageClientModule } from "./seats-page-loader";
import styles from "./seats.module.css";

function SeatsPageLoading() {
  return (
    <div className={styles.page}>
      <p className={`${styles.routeStatus} ${styles.mono}`}>Loading SeatShare…</p>
    </div>
  );
}

const SeatsPageClient = dynamic(
  () => loadSeatsPageClientModule().then((m) => m.default),
  {
    ssr: false,
    loading: SeatsPageLoading,
  },
);

export default function SeatsPage() {
  return <SeatsPageClient />;
}
