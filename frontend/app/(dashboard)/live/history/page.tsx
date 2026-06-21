"use client";

import {
  formatTrackDate,
  formatTrackDistanceMeters,
  formatTrackDuration,
  type TripTrackSummary,
} from "@/lib/live/track";
import { apiFetch } from "@/lib/api";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LiveTripHistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<TripTrackSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await apiFetch<TripTrackSummary[]>("/live/track/history");
        if (active) setItems(data);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-white px-4 py-6">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/live"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-700"
            aria-label="Back to Live"
          >
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-stone-900">Past Trips</h1>
        </div>

        {loading ? (
          <p className="text-sm text-stone-500">Loading trips…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-stone-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-stone-700">
              No trips recorded yet. Start driving!
            </p>
            <Link
              href="/live"
              className="mt-4 inline-block rounded-full bg-[#0F766E] px-4 py-2 text-sm font-semibold text-white"
            >
              Open Live
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-stone-900">
                      {formatTrackDate(item.started_at)}
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      {formatTrackDistanceMeters(item.total_distance_m)} ·{" "}
                      {formatTrackDuration(item.total_duration_s)}
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      Max {Math.round(item.max_speed_mph ?? 0)} mph
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/live?replay_session=${item.session_id}`)
                    }
                    className="rounded-full bg-[#0F766E] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Replay
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  <span className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-600">
                    {item.reports_encountered} reports
                  </span>
                  <span className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-600">
                    {item.cameras_passed} cameras
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
