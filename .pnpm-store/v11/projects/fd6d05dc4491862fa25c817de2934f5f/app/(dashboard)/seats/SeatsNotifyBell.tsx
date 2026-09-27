"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import InlineSignInModal from "@/app/(dashboard)/live/InlineSignInModal";
import { useDashboardUser } from "@/contexts/dashboard-user-context";
import { apiFetch } from "@/lib/api";
import {
  createRouteWatch,
  deleteRouteWatch,
  fetchSeatsWatchAlerts,
  fetchSeatsWatches,
  type SeatRouteWatch,
} from "./seats-api";
import { isSeatsAuthError } from "./seats-api-errors";
import { SeatsWatchRouteForm } from "./SeatsWatchRouteForm";
import styles from "./seats-notify-bell.module.css";

type SeatAlert = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  is_read: boolean;
};

export function SeatsNotifyBell() {
  const { user } = useDashboardUser();
  const [open, setOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [watches, setWatches] = useState<SeatRouteWatch[]>([]);
  const [alerts, setAlerts] = useState<SeatAlert[]>([]);
  const [badge, setBadge] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setWatches([]);
      setAlerts([]);
      setBadge(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [watchRows, summary, notif] = await Promise.all([
        fetchSeatsWatches(),
        fetchSeatsWatchAlerts(),
        apiFetch<{ notifications: SeatAlert[] }>("/notifications?limit=12"),
      ]);
      setWatches(watchRows);
      const seatAlerts = (notif.notifications ?? []).filter((n) => {
        const t = (n as { type?: string }).type;
        return t === "seats_watch_match" || /seat|route watch/i.test(`${n.title} ${n.body}`);
      });
      setAlerts(seatAlerts.slice(0, 6));
      setBadge(summary.unread_alerts);
    } catch (e) {
      if (isSeatsAuthError(e)) {
        setWatches([]);
        setBadge(0);
      } else {
        setError("Could not load SeatShare alerts.");
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh, user?.id]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function onRemoveWatch(id: string) {
    try {
      await deleteRouteWatch(id);
      await refresh();
    } catch (e) {
      if (isSeatsAuthError(e)) setSignInOpen(true);
    }
  }

  function onBellClick() {
    if (!user) {
      setSignInOpen(true);
      return;
    }
    setOpen((v) => !v);
  }

  return (
    <div className={styles.wrap} ref={panelRef}>
      <InlineSignInModal isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
      <button
        type="button"
        className={styles.bellBtn}
        aria-label="SeatShare route alerts"
        aria-expanded={open}
        onClick={onBellClick}
      >
        <Bell size={18} strokeWidth={1.8} aria-hidden />
        {badge > 0 ? <span className={styles.badge}>{badge > 9 ? "9+" : badge}</span> : null}
      </button>

      {open && user ? (
        <div className={styles.panel} role="dialog" aria-label="SeatShare notifications">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Route alerts</h2>
            <p className={styles.panelSub}>
              Pick corridors — we notify you when someone posts a matching ride.
            </p>
          </div>

          {error ? (
            <p className={styles.panelError} role="alert">
              {error}
            </p>
          ) : null}

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionLabel}>Your corridors</h3>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => setShowForm((v) => !v)}
              >
                {showForm ? "Close" : "+ Add corridor"}
              </button>
            </div>

            {showForm ? (
              <SeatsWatchRouteForm
                onSaved={async () => {
                  setShowForm(false);
                  await refresh();
                }}
                onAuthRequired={() => setSignInOpen(true)}
              />
            ) : null}

            {loading && watches.length === 0 ? (
              <p className={styles.muted}>Loading…</p>
            ) : null}

            {!loading && watches.length === 0 ? (
              <p className={styles.muted}>No corridors yet. Add From → To to get notified.</p>
            ) : null}

            <ul className={styles.watchList}>
              {watches.map((w) => (
                <li key={w.id} className={styles.watchItem}>
                  <div>
                    <p className={styles.watchRoute}>
                      {w.from_label ?? `${w.from_lat.toFixed(2)}, ${w.from_lon.toFixed(2)}`}
                      {" → "}
                      {w.to_label ?? `${w.to_lat.toFixed(2)}, ${w.to_lon.toFixed(2)}`}
                    </p>
                    <p className={styles.watchMeta}>
                      {w.seats} seat{w.seats === 1 ? "" : "s"}
                      {w.date_from ? ` · from ${w.date_from}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => void onRemoveWatch(w.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {alerts.length > 0 ? (
            <section className={styles.section}>
              <h3 className={styles.sectionLabel}>Recent alerts</h3>
              <ul className={styles.alertList}>
                {alerts.map((a) => (
                  <li key={a.id} className={styles.alertItem}>
                    <strong>{a.title}</strong>
                    <span>{a.body}</span>
                  </li>
                ))}
              </ul>
              <Link href="/notifications" className={styles.allLink} onClick={() => setOpen(false)}>
                All notifications
              </Link>
            </section>
          ) : null}

          <Link href="/seats" className={styles.footerLink} onClick={() => setOpen(false)}>
            Open SeatShare
          </Link>
        </div>
      ) : null}
    </div>
  );
}
