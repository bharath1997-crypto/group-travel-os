"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  Brain,
  Briefcase,
  CheckCircle2,
  Clock,
  Download,
  Lock,
  MapPin,
  Receipt,
  RefreshCw,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";

import { apiFetch } from "@/lib/api";
import { SettingsHubRow, SettingsScreenHeader, SettingsSectionTitle } from "../../_components";

interface ExportRequest {
  id: string;
  export_type: string;
  status: "pending" | "processing" | "ready" | "failed" | "expired";
  file_url: string | null;
  file_size_kb: number | null;
  error_message: string | null;
  requested_at: string;
  ready_at: string | null;
  expires_at: string | null;
}

function formatBytes(kb: number | null): string {
  if (kb === null) return "";
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Confirmation modal ────────────────────────────────────────────────────────

function ConfirmModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl bg-white px-5 pb-8 pt-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-stone-200" />
        </div>

        <div className="mb-5 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50">
            <Download size={26} className="text-[#0F766E]" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[17px] font-bold text-neutral-900">Request data export?</p>
            <p className="mt-1 text-[13px] leading-relaxed text-stone-500">
              We&apos;ll package your profile, trips, expenses, saved places, and AI history into a
              ZIP file. It&apos;ll be ready to download within a few minutes.
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F766E] py-3.5 text-[15px] font-semibold text-white transition-opacity disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Requesting…
              </>
            ) : (
              "Request export"
            )}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full rounded-2xl border border-stone-200 bg-white py-3.5 text-[15px] font-medium text-neutral-700 transition-colors hover:bg-stone-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Status chip ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: ExportRequest["status"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-amber-50 text-amber-700" },
    processing: { label: "Processing", cls: "bg-blue-50 text-blue-700" },
    ready: { label: "Ready", cls: "bg-teal-50 text-[#0F766E]" },
    failed: { label: "Failed", cls: "bg-red-50 text-red-600" },
    expired: { label: "Expired", cls: "bg-stone-100 text-stone-500" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-stone-100 text-stone-500" };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DownloadMyDataPage() {
  const [history, setHistory] = useState<ExportRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [toastError, setToastError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    try {
      const data = await apiFetch<ExportRequest[]>("/api/v1/data/export/history");
      setHistory(data);
    } catch {
      // No history yet
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const schedulePoll = useCallback((requestId: string) => {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = setTimeout(async () => {
      try {
        const updated = await apiFetch<ExportRequest>(`/api/v1/data/export/${requestId}`);
        setHistory((prev) => prev.map((r) => (r.id === requestId ? updated : r)));
        if (updated.status === "pending" || updated.status === "processing") {
          schedulePoll(requestId);
        }
      } catch {
        // Stop polling on error
      }
    }, 3000);
  }, []);

  // ── Request export ──────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    setRequesting(true);
    setToastError(null);
    try {
      const req = await apiFetch<ExportRequest>("/api/v1/data/export", {
        method: "POST",
        body: JSON.stringify({ export_type: "full" }),
      });
      setHistory((prev) => [req, ...prev]);
      setShowModal(false);
      schedulePoll(req.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to request export";
      setToastError(msg);
      setShowModal(false);
    } finally {
      setRequesting(false);
    }
  };

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchHistory();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [fetchHistory]);

  useEffect(() => {
    history.forEach((r) => {
      if (r.status === "pending" || r.status === "processing") {
        schedulePoll(r.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeExport = history.find(
    (r) => r.status === "pending" || r.status === "processing"
  );
  const canRequest = !activeExport && !requesting;

  return (
    <>
      <SettingsScreenHeader title="Download My Data" backHref="/settings/data-integrations" />

      {/* Error toast */}
      {toastError && (
        <div className="mx-4 mt-3 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3">
          <XCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-[13px] leading-snug text-red-700">{toastError}</p>
        </div>
      )}

      {/* Active export banner */}
      {activeExport && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <RefreshCw size={16} className="shrink-0 animate-spin text-blue-600" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-blue-800">Export in progress</p>
            <p className="text-[12px] text-blue-600">
              We&apos;ll notify you when your archive is ready to download.
            </p>
          </div>
        </div>
      )}

      {/* ── Section 1: Export Data ── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Export data</SettingsSectionTitle>
        <SettingsHubRow
          icon={Download}
          label="Request full data export"
          sublabel={
            activeExport
              ? "Export already in progress…"
              : canRequest
              ? "Download everything as a ZIP archive"
              : "Check your export history below"
          }
          onClick={canRequest ? () => setShowModal(true) : undefined}
        />
      </div>

      {/* ── Section 2: Included Data ── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>What&apos;s included</SettingsSectionTitle>
        <IncludedRow icon={User} label="Profile" sublabel="Name, email, bio, preferences" />
        <IncludedRow icon={Briefcase} label="Trips" sublabel="All trips you joined or created" />
        <IncludedRow icon={Receipt} label="Expenses" sublabel="Split bills and shared costs" />
        <IncludedRow icon={MapPin} label="Saved places" sublabel="Pinned locations and notes" />
        <IncludedRow icon={Brain} label="AI history" sublabel="Wayra personal memory entries" />
      </div>

      {/* ── Section 3: Security & Privacy ── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Security &amp; privacy</SettingsSectionTitle>
        <InfoRow icon={Clock} label="Files expire after 24 hours" />
        <InfoRow icon={Lock} label="Download links are private and authenticated" />
        <InfoRow icon={ShieldCheck} label="Exports are generated securely on our servers" />
        <InfoRow icon={Archive} label="Format: ZIP archive with JSON files" />
      </div>

      {/* ── Section 4: Export History ── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Export history</SettingsSectionTitle>
        {loadingHistory ? (
          <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3.5">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-200 border-t-stone-500" />
            <p className="text-[14px] text-stone-400">Loading…</p>
          </div>
        ) : history.length === 0 ? (
          <div className="px-4 py-4">
            <p className="text-[13px] text-stone-400">No previous exports.</p>
          </div>
        ) : (
          history.map((req) => (
            <ExportHistoryRow key={req.id} req={req} />
          ))
        )}
      </div>

      <div className="pb-10 pt-4 text-center">
        <p className="text-[12px] text-stone-400">
          Questions? Contact{" "}
          <a href="mailto:privacy@rovvy.app" className="text-[#0F766E] underline-offset-2 hover:underline">
            privacy@rovvy.app
          </a>
        </p>
      </div>

      {showModal && (
        <ConfirmModal
          onConfirm={handleConfirm}
          onCancel={() => setShowModal(false)}
          loading={requesting}
        />
      )}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function IncludedRow({
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
        <Icon size={16} className="text-stone-500" strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] text-neutral-900">{label}</p>
        <p className="mt-0.5 text-xs text-stone-400">{sublabel}</p>
      </div>
      <CheckCircle2 size={16} className="ml-auto shrink-0 text-[#0F766E]" />
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3.5 border-b border-stone-100 px-4 py-3.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100">
        <Icon size={16} className="text-stone-500" strokeWidth={1.8} />
      </div>
      <p className="text-[14px] text-neutral-900">{label}</p>
    </div>
  );
}

function ExportHistoryRow({ req }: { req: ExportRequest }) {
  const isActive = req.status === "pending" || req.status === "processing";

  return (
    <div className="border-b border-stone-100 px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] font-medium text-neutral-900">
          {req.export_type === "full" ? "Full account export" : req.export_type}
        </p>
        <StatusChip status={req.status} />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-stone-400">
        <span>Requested {formatDate(req.requested_at)}</span>
        {req.file_size_kb !== null && <span>{formatBytes(req.file_size_kb)}</span>}
        {req.expires_at && req.status === "ready" && (
          <span>Expires {formatDate(req.expires_at)}</span>
        )}
      </div>

      {isActive && (
        <div className="mt-2 flex items-center gap-2 text-[12px] text-blue-600">
          <RefreshCw size={12} className="animate-spin" />
          Processing your archive…
        </div>
      )}

      {req.status === "ready" && req.file_url && (
        <a
          href={req.file_url}
          download
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-[#0F766E] py-2.5 text-[13px] font-semibold text-[#0F766E] transition-colors hover:bg-teal-50"
        >
          <Download size={14} />
          Download ZIP
        </a>
      )}

      {req.status === "failed" && req.error_message && (
        <p className="mt-1.5 text-[12px] text-red-500">{req.error_message}</p>
      )}
    </div>
  );
}
