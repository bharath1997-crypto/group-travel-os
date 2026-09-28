"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useDashboardUser } from "@/contexts/dashboard-user-context";

import styles from "../collection.module.css";

export default function CollectionMemoryPage() {
  const pathname = usePathname();
  const { user } = useDashboardUser();
  const loginNext = encodeURIComponent(pathname || "/collection/memory");

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.loginPrompt}>
          <h1 className={`${styles.title} ${styles.serif}`}>Memory lives here</h1>
          <p className={styles.subtitle}>
            Sign in to keep articles, reels, and notes you want to revisit later.
          </p>
          <p style={{ marginTop: 20 }}>
            <Link href={`/login?next=${loginNext}`}>Log in</Link>
            {" · "}
            <Link href={`/register?next=${loginNext}`}>Sign up</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.heroRow}>
        <div>
          <div className={`${styles.eyebrow} ${styles.mono}`}>Memory</div>
          <h1 className={`${styles.title} ${styles.serif}`}>Saved links &amp; stories</h1>
          <p className={styles.subtitle}>
            Articles, reels, and notes you filed away — ready when you are. Design for this tab is coming next.
          </p>
        </div>
      </div>
      <div className={styles.emptyState}>
        <p className={styles.subtitle} style={{ margin: "0 auto" }}>
          Nothing in Memory yet. Share the design when you are ready and we will build it out.
        </p>
      </div>
    </div>
  );
}
