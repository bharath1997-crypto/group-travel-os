"use client";

import Link from "next/link";

type Props = {
  filled: number;
  total: number;
};

/**
 * Dismissible-style card prompting profile completion — no error/red tone.
 */
export function ProfileCompletionBanner({ filled, total }: Props) {
  if (filled >= total) return null;

  return (
    <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-emerald-50/40 px-4 py-3">
      <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-slate-400 ring-4 ring-slate-200/80"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              Complete your profile
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              {filled} of {total} details added — finish anytime for recovery and a
              better experience.
            </p>
          </div>
        </div>
        <Link
          href="/complete-profile"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
        >
          Complete now
        </Link>
      </div>
    </div>
  );
}
