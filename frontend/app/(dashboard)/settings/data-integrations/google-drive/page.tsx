"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Cloud,
  CloudUpload,
  ExternalLink,
  Eye,
  HardDrive,
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
import { SettingsBreadcrumb, dataSubCrumbs } from "@/components/settings/SettingsBreadcrumb";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Integration {
  id: string;
  provider: string;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
}

interface ExportRecord {
  id: string;
  export_type: string;
  format: string;
  status: string;
  requested_at: string;
  ready_at: string | null;
  expires_at: string | null;
  metadata: Record<string, string>;
}

interface BackupResult {
  google_drive_file_id: string;
  google_drive_web_view_link: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function statusColor(status: string): string {
  switch (status) {
    case "ready":      return "bg-teal-50 text-primary";
    case "processing": return "bg-amber-50 text-amber-700";
    case "pending":    return "bg-stone-100 text-stone-500";
    case "failed":     return "bg-red-50 text-red-600";
    case "expired":    return "bg-stone-100 text-stone-400";
    default:           return "bg-stone-100 text-stone-500";
  }
}

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

export default function GoogleDrivePage() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loadingIntg, setLoadingIntg] = useState(true);
  const [exports, setExports]         = useState<ExportRecord[]>([]);
  const [loadingExports, setLoadingExports] = useState(true);
  const [backingUpId, setBackingUpId] = useState<string | null>(null);
  const [backupResults, setBackupResults] = useState<Record<string, BackupResult>>({});
  const [backupErrors, setBackupErrors]   = useState<Record<string, string>>({});
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("connected") === "1") {
        url.searchParams.delete("connected");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, []);

  const fetchIntegration = useCallback(async () => {
    try {
      const all = await apiFetch<Integration[]>("/api/v1/integrations");
      const drive = all.find((i) => i.provider === "google_drive" && i.is_active) ?? null;
      setIntegration(drive);
    } catch {
      // swallow
    } finally {
      setLoadingIntg(false);
    }
  }, []);

  const fetchExports = useCallback(async () => {
    try {
      const data = await apiFetch<ExportRecord[]>("/api/v1/data/export/history");
      // Show only ready exports that can be backed up
      setExports(data.filter((e) => e.status === "ready"));
    } catch {
      // swallow
    } finally {
      setLoadingExports(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegration();
    fetchExports();
  }, [fetchIntegration, fetchExports]);

  const handleConnect = () => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    window.location.href = `${API_BASE}/integrations/google-drive/connect`;
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await apiFetch("/api/v1/integrations/google-drive/disconnect", { method: "POST" });
      setIntegration(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleBackup = async (exportId: string) => {
    setBackingUpId(exportId);
    setBackupErrors((prev) => { const n = {...prev}; delete n[exportId]; return n; });
    try {
      const result = await apiFetch<BackupResult>(
        `/api/v1/integrations/google-drive/backup-export/${exportId}`,
        { method: "POST" },
      );
      setBackupResults((prev) => ({ ...prev, [exportId]: result }));
      await fetchIntegration();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Backup failed";
      setBackupErrors((prev) => ({ ...prev, [exportId]: msg }));
    } finally {
      setBackingUpId(null);
    }
  };

  const isConnected = !!integration;

  return (
    <>
      <SettingsScreenHeader title="Google Drive Backup" backHref="/settings/data-integrations/google" />
      <SettingsBreadcrumb crumbs={dataSubCrumbs({ label: "Google", href: "/settings/data-integrations/google" }, "Google Drive")} />

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
            <div className="flex items-center gap-3.5 border-b border-stone-100 px-4 py-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50">
                <CheckCircle2 size={16} className="text-primary" strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-neutral-900">Connected</p>
                {integration.last_synced_at && (
                  <p className="mt-0.5 text-xs text-stone-400">
                    Last backed up {formatDate(integration.last_synced_at)}
                  </p>
                )}
              </div>
            </div>
            <SettingsHubRow
              icon={Link2Off}
              label="Disconnect Google Drive"
              sublabel="Remove Rovvy&apos;s access to your Google Drive"
              onClick={!disconnecting ? handleDisconnect : undefined}
              danger
            />
          </>
        ) : (
          <SettingsHubRow
            icon={Link2}
            label="Connect Google Drive"
            sublabel="Back up your Rovvy exports to Google Drive"
            onClick={handleConnect}
            accentColor="blue"
          />
        )}
      </div>

      {/* ── 2. Backup Exports (only when connected) ── */}
      {isConnected && (
        <div className="mt-3 bg-white">
          <SettingsSectionTitle>Backup exports</SettingsSectionTitle>

          {loadingExports ? (
            <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3.5">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-200 border-t-stone-500" />
              <p className="text-[14px] text-stone-400">Loading exports…</p>
            </div>
          ) : exports.length === 0 ? (
            <div className="px-4 py-5">
              <p className="text-[14px] font-medium text-neutral-900">No ready exports</p>
              <p className="mt-1 text-[13px] text-stone-400">
                Generate an export first — once it&apos;s ready you can back it up here.
              </p>
            </div>
          ) : (
            exports.map((exp) => {
              const isBacking  = backingUpId === exp.id;
              const result     = backupResults[exp.id];
              const backupErr  = backupErrors[exp.id];
              const typeLabel  = exp.export_type === "full" ? "Full Account" : exp.export_type;

              return (
                <div key={exp.id} className="border-b border-stone-100 px-4 py-3.5">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                      <HardDrive size={15} className="text-stone-500" strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] text-neutral-900">{typeLabel} Export</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusColor(exp.status)}`}>
                          {exp.status}
                        </span>
                        <span className="text-[12px] text-stone-400">
                          {formatDate(exp.ready_at || exp.requested_at)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isBacking}
                      onClick={() => handleBackup(exp.id)}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary px-3 py-1.5 text-[12px] font-semibold text-primary transition-colors hover:bg-teal-50 disabled:opacity-40"
                    >
                      {isBacking ? (
                        <><RefreshCw size={12} className="animate-spin" /> Uploading…</>
                      ) : result ? (
                        <><Cloud size={12} /> Backed up</>
                      ) : (
                        <><CloudUpload size={12} /> Backup</>
                      )}
                    </button>
                  </div>

                  {backupErr && (
                    <p className="mt-1.5 text-[12px] text-red-500">{backupErr}</p>
                  )}
                  {result && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <p className="text-[12px] text-primary">Saved to Google Drive</p>
                      {result.google_drive_web_view_link && (
                        <a
                          href={result.google_drive_web_view_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-0.5 text-[12px] text-primary underline underline-offset-2"
                        >
                          Open <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── 3. Privacy note ── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Privacy &amp; permissions</SettingsSectionTitle>
        <InfoRow
          icon={Eye}
          label="Limited access only"
          sublabel="Rovvy only uses permission to create files it generates — not read or manage existing Drive files"
        />
        <InfoRow
          icon={HardDrive}
          label="drive.file scope"
          sublabel="Rovvy cannot see or manage any files it did not create in your Drive"
        />
        <InfoRow
          icon={ShieldCheck}
          label="Tokens are encrypted"
          sublabel="Your Google OAuth tokens are encrypted at rest and never exposed"
        />
        <InfoRow
          icon={Link2Off}
          label="Revoke anytime"
          sublabel="Disconnect above to immediately revoke Rovvy&apos;s Drive access"
        />
      </div>

      <SettingsPageFooter />
    </>
  );
}
