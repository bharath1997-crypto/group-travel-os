"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";
import { SettingsScreenHeader } from "../../_components";

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
  return new Date(iso).toLocaleString();
}

function StatusBadge({ status }: { status: ExportRequest["status"] }) {
  const map = {
    pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700" },
    processing: { label: "Processing…", color: "bg-blue-100 text-blue-700" },
    ready: { label: "Ready", color: "bg-teal-100 text-teal-700" },
    failed: { label: "Failed", color: "bg-red-100 text-red-700" },
    expired: { label: "Expired", color: "bg-stone-100 text-stone-500" },
  };
  const { label, color } = map[status] ?? { label: status, color: "bg-stone-100 text-stone-500" };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

export default function DownloadMyDataPage() {
  const router = useRouter();
  const [history, setHistory] = useState<ExportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchHistory() {
    try {
      const data = await apiFetch<ExportRequest[]>("/api/v1/data/export/history");
      setHistory(data);
    } catch {
      // swallow; user may not have any yet
    } finally {
      setLoading(false);
    }
  }

  async function requestExport() {
    setRequesting(true);
    setError(null);
    try {
      const req = await apiFetch<ExportRequest>("/api/v1/data/export", {
        method: "POST",
        body: JSON.stringify({ export_type: "full" }),
      });
      setHistory((prev) => [req, ...prev]);
      schedulePoll(req.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to request export";
      setError(msg);
    } finally {
      setRequesting(false);
    }
  }

  function schedulePoll(requestId: string) {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = setTimeout(() => pollStatus(requestId), 3000);
  }

  async function pollStatus(requestId: string) {
    try {
      const updated = await apiFetch<ExportRequest>(`/api/v1/data/export/${requestId}`);
      setHistory((prev) => prev.map((r) => (r.id === requestId ? updated : r)));
      if (updated.status === "pending" || updated.status === "processing") {
        schedulePoll(requestId);
      }
    } catch {
      // stop polling on error
    }
  }

  useEffect(() => {
    fetchHistory();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  // Auto-poll any in-progress exports from history
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

      <div className="px-4 py-6 space-y-6">
        {/* Hero card */}
        <div className="rounded-2xl bg-[#1E293B] p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F766E]/20">
              <Download size={20} className="text-[#0F766E]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Full account export</p>
              <p className="text-xs text-slate-400">Profile · Trips · Expenses · Saved places · AI history</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your export is packaged as a ZIP archive containing JSON files for each data category.
            Files are available for 24 hours after generation.
          </p>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
              <XCircle size={14} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <button
            onClick={requestExport}
            disabled={!canRequest}
            className="w-full rounded-xl bg-[#0F766E] py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          >
            {requesting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={15} className="animate-spin" />
                Requesting…
              </span>
            ) : activeExport ? (
              "Export in progress…"
            ) : (
              "Request data export"
            )}
          </button>

          {activeExport && (
            <p className="text-center text-xs text-slate-500">
              We&apos;ll notify you when your export is ready.
            </p>
          )}
        </div>

        {/* History */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-slate-500" />
          </div>
        ) : history.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-1">
              Past exports
            </p>
            {history.map((req) => (
              <div
                key={req.id}
                className="rounded-2xl bg-white border border-stone-100 px-4 py-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-neutral-800">
                    {req.export_type === "full" ? "Full export" : req.export_type}
                  </p>
                  <StatusBadge status={req.status} />
                </div>

                <div className="flex items-center gap-4 text-xs text-stone-400">
                  <span>Requested {formatDate(req.requested_at)}</span>
                  {req.file_size_kb !== null && (
                    <span>{formatBytes(req.file_size_kb)}</span>
                  )}
                </div>

                {req.status === "ready" && req.file_url && (
                  <a
                    href={req.file_url}
                    download
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#0F766E] py-2 text-sm font-semibold text-white"
                  >
                    <CheckCircle2 size={14} />
                    Download ZIP
                  </a>
                )}

                {req.status === "failed" && req.error_message && (
                  <p className="text-xs text-red-500">{req.error_message}</p>
                )}

                {req.expires_at && req.status === "ready" && (
                  <p className="text-xs text-stone-400">
                    Expires {formatDate(req.expires_at)}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {/* Privacy note */}
        <p className="text-center text-xs text-slate-500 px-2 leading-relaxed">
          Your data is yours. Exports are securely generated and available for 24 hours.
          For questions: privacy@rovvy.app
        </p>
      </div>
    </>
  );
}
