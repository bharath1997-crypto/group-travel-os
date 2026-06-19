"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Briefcase,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Eye,
  Link2,
  Link2Off,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { apiFetch } from "@/lib/api";
import {
  SettingsHubRow,
  SettingsPageFooter,
  SettingsScreenHeader,
  SettingsSectionTitle,
} from "../../_components";
import { SettingsBreadcrumb, dataCrumbs } from "@/components/settings/SettingsBreadcrumb";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Integration {
  id: string;
  provider: string;
  is_active: boolean;
  scopes: string[];
  last_synced_at: string | null;
  created_at: string;
}

interface Trip {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
}

interface SyncResult {
  google_event_id: string;
  action: "created" | "updated";
  trip_id: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function formatTripDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ── Static info row ───────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  sublabel,
}: {
  icon: React.ElementType;
  label: string;
  sublabel: string;
}) {
  return (
    <div className="flex items-center gap-3.5 border-b border-stone-100 px-4 py-3.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100">
        <Icon size={16} className="text-stone-600" strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] leading-snug text-neutral-900">{label}</p>
        <p className="mt-0.5 text-xs leading-snug text-stone-400">{sublabel}</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GoogleCalendarPage() {
  const [integration, setIntegration]   = useState<Integration | null>(null);
  const [loadingIntg, setLoadingIntg]   = useState(true);
  const [trips, setTrips]               = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [syncingId, setSyncingId]       = useState<string | null>(null);
  const [syncResults, setSyncResults]   = useState<Record<string, SyncResult>>({});
  const [syncErrors, setSyncErrors]     = useState<Record<string, string>>({});
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // ── Connected param from OAuth callback ────────────────────────────────────

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("connected") === "1") {
        url.searchParams.delete("connected");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, []);

  // ── Fetch integration status ────────────────────────────────────────────────

  const fetchIntegration = useCallback(async () => {
    try {
      const all = await apiFetch<Integration[]>("/api/v1/integrations");
      const gcal = all.find((i) => i.provider === "google_calendar" && i.is_active) ?? null;
      setIntegration(gcal);
    } catch {
      // swallow
    } finally {
      setLoadingIntg(false);
    }
  }, []);

  // ── Fetch user's trips ──────────────────────────────────────────────────────

  const fetchTrips = useCallback(async () => {
    try {
      const data = await apiFetch<Trip[]>("/api/v1/trips");
      setTrips(data);
    } catch {
      // swallow
    } finally {
      setLoadingTrips(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegration();
    fetchTrips();
  }, [fetchIntegration, fetchTrips]);

  // ── Connect ─────────────────────────────────────────────────────────────────

  const handleConnect = () => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    // Include JWT in the redirect so the backend connect endpoint can auth the user
    window.location.href = `${API_BASE}/integrations/google-calendar/connect`;
  };

  // ── Disconnect ──────────────────────────────────────────────────────────────

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await apiFetch("/api/v1/integrations/google-calendar/disconnect", { method: "POST" });
      setIntegration(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  // ── Sync trip ───────────────────────────────────────────────────────────────

  const handleSyncTrip = async (tripId: string) => {
    setSyncingId(tripId);
    setSyncErrors((prev) => { const n = {...prev}; delete n[tripId]; return n; });
    try {
      const result = await apiFetch<SyncResult>(
        `/api/v1/integrations/google-calendar/sync-trip/${tripId}`,
        { method: "POST" },
      );
      setSyncResults((prev) => ({ ...prev, [tripId]: result }));
      await fetchIntegration();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      setSyncErrors((prev) => ({ ...prev, [tripId]: msg }));
    } finally {
      setSyncingId(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const isConnected = !!integration;

  return (
    <>
      <SettingsScreenHeader title="Google Calendar Sync" backHref="/settings/data-integrations" />
      <SettingsBreadcrumb crumbs={dataCrumbs("Google Calendar")} />

      {error && (
        <div className="mx-4 mt-3 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3">
          <XCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-[13px] leading-snug text-red-700">{error}</p>
        </div>
      )}

      {/* ── 1. Connection Status ── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Connection status</SettingsSectionTitle>

        {loadingIntg ? (
          <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3.5">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-200 border-t-stone-500" />
            <p className="text-[14px] text-stone-400">Checking connection…</p>
          </div>
        ) : isConnected ? (
          <>
            {/* Connected indicator */}
            <div className="flex items-center gap-3.5 border-b border-stone-100 px-4 py-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50">
                <CheckCircle2 size={16} className="text-[#0F766E]" strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-neutral-900">Connected</p>
                {integration.last_synced_at && (
                  <p className="mt-0.5 text-xs text-stone-400">
                    Last synced {formatDate(integration.last_synced_at)}
                  </p>
                )}
              </div>
            </div>

            {/* Disconnect row */}
            <SettingsHubRow
              icon={Link2Off}
              label="Disconnect Google Calendar"
              sublabel="Remove Rovvy&apos;s access to your Google Calendar"
              onClick={!disconnecting ? handleDisconnect : undefined}
              danger
            />
          </>
        ) : (
          <SettingsHubRow
            icon={Link2}
            label="Connect Google Calendar"
            sublabel="Sync your Rovvy trips to Google Calendar"
            onClick={handleConnect}
            accentColor="blue"
          />
        )}
      </div>

      {/* ── 2. Sync Trips (only when connected) ── */}
      {isConnected && (
        <div className="mt-3 bg-white">
          <SettingsSectionTitle>Sync trips</SettingsSectionTitle>

          {loadingTrips ? (
            <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3.5">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-200 border-t-stone-500" />
              <p className="text-[14px] text-stone-400">Loading trips…</p>
            </div>
          ) : trips.length === 0 ? (
            <div className="px-4 py-5">
              <p className="text-[14px] font-medium text-neutral-900">No trips found</p>
              <p className="mt-1 text-[13px] text-stone-400">
                Join or create a trip to sync it to your calendar.
              </p>
            </div>
          ) : (
            trips.map((trip) => {
              const isSyncing = syncingId === trip.id;
              const result    = syncResults[trip.id];
              const syncErr   = syncErrors[trip.id];
              const dateRange =
                trip.start_date
                  ? `${formatTripDate(trip.start_date)}${trip.end_date ? ` – ${formatTripDate(trip.end_date)}` : ""}`
                  : null;

              return (
                <div key={trip.id} className="border-b border-stone-100 px-4 py-3.5">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                      <Briefcase size={15} className="text-stone-500" strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] text-neutral-900">{trip.title}</p>
                      {dateRange && (
                        <p className="mt-0.5 text-[12px] text-stone-400">{dateRange}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={() => handleSyncTrip(trip.id)}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#0F766E] px-3 py-1.5 text-[12px] font-semibold text-[#0F766E] transition-colors hover:bg-teal-50 disabled:opacity-40"
                    >
                      {isSyncing ? (
                        <><RefreshCw size={12} className="animate-spin" /> Syncing…</>
                      ) : result ? (
                        <><CalendarCheck2 size={12} /> {result.action === "created" ? "Added" : "Updated"}</>
                      ) : (
                        <><CalendarDays size={12} /> Sync</>
                      )}
                    </button>
                  </div>
                  {syncErr && (
                    <p className="mt-1.5 text-[12px] text-red-500">{syncErr}</p>
                  )}
                  {result && (
                    <p className="mt-1 text-[12px] text-[#0F766E]">
                      {result.action === "created" ? "Added to" : "Updated in"} Google Calendar
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── 3. Privacy Note ── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Privacy &amp; permissions</SettingsSectionTitle>
        <InfoRow
          icon={Eye}
          label="Limited access only"
          sublabel="Rovvy only requests permission to create and manage events it creates — not read all calendar events"
        />
        <InfoRow
          icon={CalendarDays}
          label="Push-only sync"
          sublabel="Rovvy pushes trips to your calendar. Your existing events are never read or modified"
        />
        <InfoRow
          icon={ShieldCheck}
          label="Tokens are encrypted"
          sublabel="Your Google OAuth tokens are encrypted at rest and never exposed"
        />
        <InfoRow
          icon={Link2Off}
          label="Revoke anytime"
          sublabel="Disconnect above to immediately revoke Rovvy&apos;s calendar access"
        />
      </div>

      {/* Footer */}
      <div className="pb-10 pt-4 text-center">
        <p className="text-[12px] text-stone-400">
          Questions?{" "}
          <a
            href="mailto:privacy@rovvy.app"
            className="text-[#0F766E] underline-offset-2 hover:underline"
          >
            privacy@rovvy.app
          </a>
        </p>
      </div>

      <SettingsPageFooter />
    </>
  );
}
