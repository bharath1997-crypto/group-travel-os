"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type GuestSignInCardProps = {
  title: string;
  description?: string;
};

export function GuestSignInCard({ title, description }: GuestSignInCardProps) {
  const pathname = usePathname();
  const loginHref = `/login?next=${encodeURIComponent(pathname || "/explore")}`;

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          {description}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={loginHref}
          className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-primary/30 hover:text-primary"
        >
          Log in
        </Link>
        <Link
          href="/register"
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          Sign up
        </Link>
        <Link
          href="/explore"
          className="px-2 py-2.5 text-sm font-semibold text-stone-500 transition hover:text-primary"
        >
          Back to Explore
        </Link>
      </div>
    </div>
  );
}
