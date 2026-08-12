"use client";

import Link from "next/link";
import { LogIn, Plane } from "lucide-react";

type Props = {
  title?: string;
  message?: string;
};

export default function FlightsAuthPrompt({
  title = "Sign in to search flights",
  message = "Live fares and in-app booking are available for signed-in Rovvy members.",
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
        <Plane className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">{message}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700"
        >
          <LogIn className="h-4 w-4" />
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
