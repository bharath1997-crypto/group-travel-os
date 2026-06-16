"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  FileUp,
  MapPin,
  RefreshCw,
  TriangleAlert,
  Upload,
  Briefcase,
  XCircle,
} from "lucide-react";

import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { SettingsScreenHeader, SettingsSectionTitle } from "../../_components";
import { SettingsBreadcrumb, dataCrumbs } from "@/components/settings/SettingsBreadcrumb";

// ── Types ─────────────────────────────────────────────────────────────────────

type ImportType = "places" | "trips";

interface PreviewRow {
  index: number;
  status: "valid" | "duplicate" | "error";
  data: Record<string, unknown>;
  reason: string | null;
}

interface PreviewResult {
  import_id: string;
  status: string;
  import_type: string;
  format: string;
  original_filename: string | null;
  total_items: number;
  valid_items: number;
  duplicate_items: number;
  error_items: number;
  preview: PreviewRow[];
}

interface ConfirmResult {
  import_id: string;
  status: string;
  import_type: string;
  imported_count: number;
  skipped_duplicates: number;
}

interface ImportHistory {
  id: string;
  import_type: string;
  format: string;
  status: string;
  original_filename: string | null;
  total_items: number;
  valid_items: number;
  duplicate_items: number;
  error_items: number;
  created_at: string;
  imported_at: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

// ── Status chip ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    preview:  { label: "Preview",  cls: "bg-amber-50 text-amber-700" },
    imported: { label: "Imported", cls: "bg-teal-50 text-[#0F766E]" },
    failed:   { label: "Failed",   cls: "bg-red-50 text-red-600" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-stone-100 text-stone-500" };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// ── Preview row chip ──────────────────────────────────────────────────────────

function RowStatusChip({ status }: { status: PreviewRow["status"] }) {
  const map = {
    valid:     { label: "Valid",     cls: "bg-teal-50 text-[#0F766E]" },
    duplicate: { label: "Duplicate", cls: "bg-amber-50 text-amber-700" },
    error:     { label: "Error",     cls: "bg-red-50 text-red-600" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-stone-100 text-stone-500" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// ── History row ───────────────────────────────────────────────────────────────

function ImportHistoryRow({ item }: { item: ImportHistory }) {
  const typeLabel = item.import_type === "places" ? "Saved Places" : "Trips";
  return (
    <div className="border-b border-stone-100 px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] font-medium text-neutral-900">
          {typeLabel} — {item.format.toUpperCase()}
        </p>
        <StatusChip status={item.status} />
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-stone-400">
        {item.original_filename && <span>{item.original_filename}</span>}
        <span>{item.total_items} items</span>
        {item.status === "imported" && (
          <span>{item.valid_items} imported · {item.duplicate_items} skipped</span>
        )}
        <span>{formatDate(item.created_at)}</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ImportDataPage() {
  const [importType, setImportType] = useState<ImportType>("places");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewing, setPreviewing]     = useState(false);
  const [confirming, setConfirming]     = useState(false);
  const [preview, setPreview]           = useState<PreviewResult | null>(null);
  const [confirmed, setConfirmed]       = useState<ConfirmResult | null>(null);
  const [history, setHistory]           = useState<ImportHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewSectionRef = useRef<HTMLDivElement>(null);
  const historySectionRef = useRef<HTMLDivElement>(null);

  // ── Fetch history ───────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    try {
      const data = await apiFetch<ImportHistory[]>("/api/v1/data/import/history");
      setHistory(data);
    } catch {
      // swallow
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── File selection ──────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setSelectedFile(f);
    setPreview(null);
    setConfirmed(null);
    setError(null);
  };

  // ── Preview ─────────────────────────────────────────────────────────────────

  const handlePreview = async () => {
    if (!selectedFile) return;
    setPreviewing(true);
    setError(null);
    setPreview(null);
    setConfirmed(null);

    try {
      const token = getToken();
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("import_type", importType);

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const res = await fetch(`${API_BASE}/data/import/preview`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as Record<string, unknown>;
        const detail = typeof errBody.detail === "string" ? errBody.detail : "Preview failed";
        throw new Error(detail);
      }

      const result = await res.json() as PreviewResult;
      setPreview(result);
      setTimeout(() => {
        previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to preview file");
    } finally {
      setPreviewing(false);
    }
  };

  // ── Confirm ─────────────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!preview) return;
    setConfirming(true);
    setError(null);

    try {
      const result = await apiFetch<ConfirmResult>(
        `/api/v1/data/import/${preview.import_id}/confirm`,
        { method: "POST" },
      );
      setConfirmed(result);
      setPreview(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchHistory();
      setTimeout(() => {
        historySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setConfirming(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const acceptedExtensions = importType === "places"
    ? ".geojson,.json,.gpx,.csv"
    : ".csv";

  return (
    <>
      <SettingsScreenHeader title="Import Data" backHref="/settings/data-integrations" />
      <SettingsBreadcrumb crumbs={dataCrumbs("Import Data")} />

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3">
          <XCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-[13px] leading-snug text-red-700">{error}</p>
        </div>
      )}

      {/* Success banner */}
      {confirmed && (
        <div className="mx-4 mt-3 flex items-start gap-2.5 rounded-xl border border-teal-100 bg-teal-50 px-3.5 py-3">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#0F766E]" />
          <div>
            <p className="text-[13px] font-semibold text-[#0F766E]">Import complete</p>
            <p className="text-[12px] text-teal-700">
              {confirmed.imported_count} item{confirmed.imported_count !== 1 ? "s" : ""} imported
              {confirmed.skipped_duplicates > 0
                ? ` · ${confirmed.skipped_duplicates} duplicate${confirmed.skipped_duplicates !== 1 ? "s" : ""} skipped`
                : ""}
            </p>
          </div>
        </div>
      )}

      {/* ── 1. Upload Data ── */}
      <div className="mt-3 bg-white">
        <SettingsSectionTitle>Upload data</SettingsSectionTitle>

        {/* Import type selector */}
        <div className="border-b border-stone-100 px-4 py-3.5">
          <p className="mb-2 text-[13px] font-semibold text-stone-500">Import type</p>
          <div className="flex gap-2">
            {(["places", "trips"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setImportType(t); setPreview(null); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  importType === t
                    ? "border-[#0F766E] bg-teal-50 text-[#0F766E]"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                {t === "places" ? <MapPin size={13} /> : <Briefcase size={13} />}
                {t === "places" ? "Saved Places" : "Trips"}
              </button>
            ))}
          </div>
        </div>

        {/* File upload row */}
        <label className="flex cursor-pointer items-center gap-3.5 border-b border-stone-100 px-4 py-3.5 transition-colors hover:bg-stone-50 active:bg-stone-100">
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedExtensions}
            className="sr-only"
            onChange={handleFileChange}
          />
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100">
            <FileUp size={16} className="text-stone-600" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-neutral-900">
              {selectedFile ? selectedFile.name : "Choose file"}
            </p>
            <p className="mt-0.5 text-xs text-stone-400">
              {importType === "places"
                ? "Supported: .geojson, .json, .gpx, .csv"
                : "Supported: .csv"}
            </p>
          </div>
          <Upload size={15} className="shrink-0 text-stone-400" />
        </label>

        {/* Preview button row */}
        <div className="px-4 py-3.5">
          <button
            type="button"
            onClick={handlePreview}
            disabled={!selectedFile || previewing}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F766E] py-3 text-[14px] font-semibold text-white transition-opacity disabled:opacity-40"
          >
            {previewing ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Previewing…
              </>
            ) : (
              "Preview Import"
            )}
          </button>
        </div>
      </div>

      {/* ── 2. Preview Results ── */}
      {preview && (
        <div ref={previewSectionRef} className="mt-3 scroll-mt-16 bg-white">
          <SettingsSectionTitle>Preview results</SettingsSectionTitle>

          {/* Stats row */}
          <div className="grid grid-cols-3 divide-x divide-stone-100 border-b border-stone-100">
            <StatCell value={preview.valid_items} label="Valid" color="text-[#0F766E]" />
            <StatCell value={preview.duplicate_items} label="Duplicates" color="text-amber-600" />
            <StatCell value={preview.error_items} label="Errors" color="text-red-500" />
          </div>

          {/* Preview rows */}
          {preview.preview.length > 0 && (
            <div className="border-b border-stone-100">
              <p className="px-4 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-wide text-stone-400">
                First {Math.min(preview.preview.length, 10)} rows
              </p>
              {preview.preview.slice(0, 10).map((row) => {
                const label =
                  preview.import_type === "places"
                    ? String((row.data as { name?: string }).name ?? `Row ${row.index + 1}`)
                    : String((row.data as { title?: string }).title ?? `Row ${row.index + 1}`);
                return (
                  <div
                    key={row.index}
                    className="flex items-center gap-3 border-b border-stone-50 px-4 py-2.5 last:border-0"
                  >
                    <p className="min-w-0 flex-1 truncate text-[13px] text-neutral-900">{label}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      {row.reason && (
                        <p className="text-[11px] text-stone-400">{row.reason}</p>
                      )}
                      <RowStatusChip status={row.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Confirm section */}
          <div className="px-4 py-4">
            {preview.valid_items === 0 ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-3">
                <TriangleAlert size={15} className="shrink-0 text-amber-600" />
                <p className="text-[13px] text-amber-700">
                  No valid items to import. Fix errors in your file and try again.
                </p>
              </div>
            ) : (
              <>
                <p className="mb-3 text-[13px] text-stone-500">
                  <strong className="text-neutral-900">{preview.valid_items}</strong> item
                  {preview.valid_items !== 1 ? "s" : ""} will be imported.
                  {preview.duplicate_items > 0 && (
                    <> <strong className="text-amber-600">{preview.duplicate_items}</strong> duplicate
                    {preview.duplicate_items !== 1 ? "s" : ""} will be skipped.</>
                  )}
                </p>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F766E] py-3 text-[14px] font-semibold text-white transition-opacity disabled:opacity-40"
                >
                  {confirming ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      Importing…
                    </>
                  ) : (
                    `Confirm Import (${preview.valid_items} item${preview.valid_items !== 1 ? "s" : ""})`
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 3. Import History ── */}
      <div ref={historySectionRef} className="mt-3 scroll-mt-16 bg-white">
        <SettingsSectionTitle>Import history</SettingsSectionTitle>

        {loadingHistory ? (
          <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3.5">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-stone-200 border-t-stone-500" />
            <p className="text-[14px] text-stone-400">Loading…</p>
          </div>
        ) : history.length === 0 ? (
          <div className="px-4 py-6">
            <p className="text-[14px] font-medium text-neutral-900">No imports yet</p>
            <p className="mt-1 text-[13px] leading-relaxed text-stone-400">
              Upload a file above to start importing your data.
            </p>
          </div>
        ) : (
          history.map((item) => <ImportHistoryRow key={item.id} item={item} />)
        )}
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
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCell({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center py-4">
      <p className={`text-[22px] font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-stone-400">{label}</p>
    </div>
  );
}
