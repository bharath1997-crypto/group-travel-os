"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

type Destination = {
  id: string;
  name: string;
  country: string;
  category: string;
  trending_score: number;
  image_url: string | null;
  best_months: number[] | null;
  avg_cost_per_day: number | null;
};

type TrendingResponse = {
  items: Destination[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

const FILTERS = [
  { label: "All", value: null as string | null },
  { label: "Beach", value: "beach" },
  { label: "City", value: "city" },
  { label: "Adventure", value: "adventure" },
  { label: "Culture", value: "culture" },
  { label: "Nature", value: "nature" },
];

export default function FeedPage() {
  const [category, setCategory] = useState<string | null>(null);
  const [data, setData] = useState<TrendingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs =
          category != null && category !== ""
            ? `?category=${encodeURIComponent(category)}`
            : "";
        const res = await apiFetch<TrendingResponse>(`/feed/trending${qs}`);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load feed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category]);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Feed</h1>
      <p className="mt-1 text-sm text-gray-600">Trending destinations</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map(({ label, value }) => {
          const selected =
            value === null ? category === null : category === value;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setCategory(value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                selected
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="mt-10 flex flex-col items-center gap-3 py-16">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900"
            aria-hidden
          />
          <p className="text-sm text-gray-600">Loading destinations…</p>
        </div>
      ) : error ? (
        <p className="mt-10 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(data?.items ?? []).map((d) => (
            <article
              key={d.id}
              className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {d.name}
                  </h2>
                  <p className="text-sm text-gray-600">{d.country}</p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium capitalize text-gray-800">
                  {d.category}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-gray-500">Trending</dt>
                  <dd className="font-medium text-gray-900">
                    {d.trending_score.toFixed(1)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Avg / day</dt>
                  <dd className="font-medium text-gray-900">
                    {d.avg_cost_per_day != null
                      ? `$${d.avg_cost_per_day.toFixed(0)}`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
