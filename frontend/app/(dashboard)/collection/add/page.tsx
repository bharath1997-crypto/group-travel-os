"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useDashboardUser } from "@/contexts/dashboard-user-context";

import { createCollectionItem } from "../collection-api";
import { parseSharedPlace, sharedPlaceKey } from "../collection-share-link";
import styles from "../collection.module.css";

/**
 * A friend shared a place from Rovvy (WhatsApp, Messages, ...). This page opens in Rovvy and
 * lets the receiver save it to their own Unsorted. Nothing is saved until they tap Save.
 */
function AddSharedPlace() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useDashboardUser();
  const place = useMemo(() => parseSharedPlace(params), [params]);
  const [name, setName] = useState(place?.name ?? "");
  const [city, setCity] = useState(place?.city ?? "");
  const [category, setCategory] = useState(place?.category ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goLogin = () => router.push(`/login?next=${encodeURIComponent(`/collection/add?${params.toString()}`)}`);

  const save = async () => {
    if (!place || !name.trim() || busy) return;
    if (loading) return;
    if (!user) {
      goLogin();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createCollectionItem({
        name: name.trim(),
        city: city.trim() || null,
        country: place.country || null,
        category: category.trim() || null,
        source: "Friend",
        saved_from: sharedPlaceKey(place),
        match_status: "unknown",
        // A friend's pin is not confirmed against our places, so it waits in Unsorted.
        is_unsorted: true,
      });
      router.replace("/collection");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this place");
      setBusy(false);
    }
  };

  if (!place) {
    return (
      <div className={styles.page}>
        <div className={styles.errorBox} role="alert">
          <p>This share link is missing the place.</p>
          <button type="button" className={styles.readBtn} onClick={() => router.replace("/collection")}>
            Open my collection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pasteCard}>
        <div className={`${styles.pasteEyebrow} ${styles.mono}`}>A friend shared a place</div>
        <div className={`${styles.pasteTitle} ${styles.serif}`}>Save it to your Rovvy collection?</div>
        <div className={styles.shareOptions}>
          <label className={styles.editLabel}>
            <span className={styles.mono}>Name</span>
            <input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className={styles.editLabel}>
            <span className={styles.mono}>City</span>
            <input value={city} maxLength={120} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label className={styles.editLabel}>
            <span className={styles.mono}>Category</span>
            <input value={category} maxLength={80} onChange={(e) => setCategory(e.target.value)} />
          </label>
          {place.from ? (
            <p className={styles.candidateHint}>
              Original:{" "}
              <a className={styles.sourceLink} href={place.from} target="_blank" rel="noopener noreferrer">
                {new URL(place.from).hostname.replace(/^www\./, "")}
              </a>
            </p>
          ) : null}
        </div>
        {error ? (
          <p className={styles.candidateHint} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.editActions} style={{ marginTop: 12 }}>
          <button type="button" className={styles.readBtn} disabled={busy || loading || !name.trim()} onClick={() => void save()}>
            {busy ? "Saving…" : loading || user ? "Save to Unsorted" : "Sign in to save"}
          </button>
          <button type="button" className={styles.filterBtn} disabled={busy} onClick={() => router.replace("/collection")}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CollectionAddPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Opening…</p>}>
      <AddSharedPlace />
    </Suspense>
  );
}
