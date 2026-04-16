"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";
import { useDashboardUser } from "@/contexts/dashboard-user-context";

type Me = {
  email: string;
  full_name: string;
  username: string | null;
  phone: string | null;
  country: string | null;
  recovery_email: string | null;
  avatar_url: string | null;
  profile_completion_filled: number;
  profile_completion_total: number;
};

const field =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

export default function CompleteProfilePage() {
  const { refreshUser } = useDashboardUser();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const u = await apiFetch<Me>("/auth/me");
        if (c) return;
        setMe(u);
        setFullName(u.full_name ?? "");
        setUsername(u.username ?? "");
        setPhone(u.phone ?? "");
        setCountry(u.country ?? "");
        setRecoveryEmail(u.recovery_email ?? "");
        setAvatarUrl(u.avatar_url ?? "");
      } catch {
        if (!c) router.replace("/login");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      const u = await apiFetch<Me>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: fullName.trim(),
          username: username.trim() || null,
          phone: phone.trim() || null,
          country: country.trim() || null,
          recovery_email: recoveryEmail.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        }),
      });
      setMe(u);
      await refreshUser();
      router.replace("/dashboard");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  const filled = me?.profile_completion_filled ?? 0;
  const total = me?.profile_completion_total ?? 6;
  const pct = Math.round((filled / total) * 100);

  return (
    <div className="mx-auto max-w-xl px-4 py-8 pb-16 sm:py-10">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
          Almost there
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Complete your profile
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          A few details help your group recognize you and keep your account
          recoverable. Everything here can be updated later in Settings.
        </p>
        <div className="mx-auto mt-5 max-w-sm">
          <div className="mb-1 flex justify-between text-xs font-medium text-slate-500">
            <span>Progress</span>
            <span className="tabular-nums text-slate-700">
              {filled} / {total} · {pct}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.25)] sm:p-7"
      >
        <section>
          <h2 className="text-sm font-semibold text-slate-900">Identity</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            How you appear to travelers and organizers.
          </p>
          <p className="mt-2 rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
            <span className="font-medium text-slate-700">Please confirm</span> your
            name below (Google may have prefilled it). Double-check spelling.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="cp-full"
                className="text-xs font-semibold uppercase tracking-wide text-slate-700"
              >
                Full name
              </label>
              <input
                id="cp-full"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={field}
                autoComplete="name"
                required
                minLength={2}
              />
            </div>
            <div>
              <label
                htmlFor="cp-user"
                className="text-xs font-semibold uppercase tracking-wide text-slate-700"
              >
                Username
              </label>
              <input
                id="cp-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={field}
                autoComplete="username"
                placeholder="e.g. river_wanderer"
              />
            </div>
            <div>
              <label
                htmlFor="cp-avatar"
                className="text-xs font-semibold uppercase tracking-wide text-slate-700"
              >
                Profile photo URL{" "}
                <span className="font-normal normal-case text-slate-500">
                  (optional)
                </span>
              </label>
              <input
                id="cp-avatar"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className={field}
                type="url"
                placeholder="https://…"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                We&apos;ll use this across the app. OAuth may have already set one.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-900">Contact & location</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Useful for coordination and account safety.
          </p>
          <p className="mt-2 rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
            <span className="font-medium text-slate-700">Please confirm</span> your
            country / region — it helps with trips, time zones, and offers.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="cp-phone"
                className="text-xs font-semibold uppercase tracking-wide text-slate-700"
              >
                Phone number{" "}
                <span className="font-normal normal-case text-slate-500">
                  (optional)
                </span>
              </label>
              <input
                id="cp-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={field}
                inputMode="tel"
                autoComplete="tel"
                placeholder="+1 …"
              />
            </div>
            <div>
              <label
                htmlFor="cp-country"
                className="text-xs font-semibold uppercase tracking-wide text-slate-700"
              >
                Country / region{" "}
                <span className="font-normal normal-case text-slate-500">
                  (optional)
                </span>
              </label>
              <input
                id="cp-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={field}
                autoComplete="country-name"
                placeholder="e.g. United States"
              />
            </div>
            <div>
              <label
                htmlFor="cp-recovery"
                className="text-xs font-semibold uppercase tracking-wide text-slate-700"
              >
                Recovery email{" "}
                <span className="font-normal normal-case text-slate-500">
                  (optional)
                </span>
              </label>
              <input
                id="cp-recovery"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                className={field}
                type="email"
                autoComplete="email"
                placeholder="Different from your login email"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Must differ from {me?.email} to count toward profile strength.
              </p>
            </div>
          </div>
        </section>

        {msg ? (
          <p className="text-sm text-red-600" role="alert">
            {msg}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:order-1"
            onClick={() => router.push("/dashboard")}
          >
            Skip for now
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 sm:order-2"
          >
            {saving ? "Saving…" : "Save and continue"}
          </button>
        </div>
      </form>
    </div>
  );
}
