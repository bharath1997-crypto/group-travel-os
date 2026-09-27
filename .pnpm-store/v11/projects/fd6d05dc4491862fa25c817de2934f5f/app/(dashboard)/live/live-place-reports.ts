import { apiFetch, apiFetchWithStatus, ApiFetchError } from "@/lib/safe-fetch";
import { getToken } from "@/lib/auth";
import type { LivePlaceReportSummary, LivePlaceReportType } from "./live-place-report-types";

export type SubmitLivePlaceReportInput = {
  lat: number;
  lng: number;
  reportType: LivePlaceReportType;
  placeName?: string | null;
  placeKey?: string | null;
};

export type SubmitLivePlaceReportResult =
  | { ok: true; confirmed: boolean; matchCount: number }
  | { ok: false; reason: "auth_required" | "error"; message?: string };

export async function submitLivePlaceReport(
  input: SubmitLivePlaceReportInput,
): Promise<SubmitLivePlaceReportResult> {
  if (!getToken()) {
    return { ok: false, reason: "auth_required" };
  }

  const { data, status } = await apiFetchWithStatus<{
    id: string;
    reportType: LivePlaceReportType;
    matchCount: number;
    confirmed: boolean;
  }>("/live/place-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lat: input.lat,
      lng: input.lng,
      reportType: input.reportType,
      placeName: input.placeName ?? null,
      placeKey: input.placeKey ?? null,
    }),
  });

  if (status === 401 || status === 403) {
    return { ok: false, reason: "auth_required" };
  }
  if (!data) {
    return {
      ok: false,
      reason: "error",
      message: `Could not send report (status ${status}).`,
    };
  }

  return {
    ok: true,
    confirmed: data.confirmed,
    matchCount: data.matchCount,
  };
}

export async function fetchNearbyLivePlaceReports(
  lat: number,
  lng: number,
  radiusM = 2500,
): Promise<LivePlaceReportSummary[]> {
  try {
    const data = await apiFetch<{
      reports: LivePlaceReportSummary[];
    }>(
      `/live/place-reports/nearby?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&radiusM=${encodeURIComponent(String(radiusM))}`,
    );
    return Array.isArray(data.reports) ? data.reports : [];
  } catch (err) {
    if (err instanceof ApiFetchError) {
      return [];
    }
    return [];
  }
}
