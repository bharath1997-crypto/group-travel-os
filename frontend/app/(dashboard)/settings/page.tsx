"use client";

import { type FormEvent, useEffect, useState } from "react";

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
  profile_public?: boolean;
  profile_completion_filled: number;
  profile_completion_total: number;
};

const field =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#E94560] focus:ring-2 focus:ring-[#E94560]/20";

export default function SettingsPage() {
  const { refreshUser } = useDashboardUser();
  const [me, setMe] = useState<Me | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profilePublic, setProfilePublic] = useState(true);
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
        setProfilePublic(u.profile_public ?? true);
      } catch {
        if (!c) setMsg("Could not load profile.");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

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
          profile_public: profilePublic,
        }),
      });
      setMe(u);
      setMsg("Saved.");
      await refreshUser();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[#E94560]" />
      </div>
    );
  }

  const filled = me?.profile_completion_filled ?? 0;
  const total = me?.profile_completion_total ?? 6;

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Settings
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Manage your profile and recovery options.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/80 p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Profile strength
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
              style={{ width: `${(filled / total) * 100}%` }}
            />
          </div>
          <span className="text-sm font-semibold tabular-nums text-slate-800">
            {filled}/{total}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Tracks: name, username, phone, photo URL, country, recovery email
          (must differ from login).
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <input
            id="profile-public"
            type="checkbox"
            checked={profilePublic}
            onChange={(e) => setProfilePublic(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300"
          />
          <div>
            <label
              htmlFor="profile-public"
              className="text-sm font-medium text-slate-900"
            >
              Public profile on shared trip links
            </label>
            <p className="mt-1 text-xs text-slate-500">
              When off, your name is hidden on trip preview pages (counts still
              show).
            </p>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">
            Login email
          </label>
          <p className="mt-1 text-sm text-slate-600">{me?.email}</p>
        </div>
        <div>
          <label
            htmlFor="set-full"
            className="block text-xs font-semibold uppercase tracking-wide text-slate-700"
          >
            Full name
          </label>
          <input
            id="set-full"
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
            htmlFor="set-username"
            className="block text-xs font-semibold uppercase tracking-wide text-slate-700"
          >
            Username
          </label>
          <input
            id="set-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={field}
            placeholder="your_handle"
            autoComplete="username"
          />
        </div>
        <div>
          <label
            htmlFor="set-phone"
            className="block text-xs font-semibold uppercase tracking-wide text-slate-700"
          >
            Phone (optional)
          </label>
          <input
            id="set-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={field}
            placeholder="+1 …"
            inputMode="tel"
            autoComplete="tel"
          />
        </div>
        <div>
          <label
            htmlFor="set-country"
            className="block text-xs font-semibold uppercase tracking-wide text-slate-700"
          >
            Country / region (optional)
          </label>
          <input
            id="set-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={field}
            autoComplete="country-name"
          />
        </div>
        <div>
          <label
            htmlFor="set-recovery"
            className="block text-xs font-semibold uppercase tracking-wide text-slate-700"
          >
            Recovery email (optional)
          </label>
          <input
            id="set-recovery"
            value={recoveryEmail}
            onChange={(e) => setRecoveryEmail(e.target.value)}
            className={field}
            type="email"
            autoComplete="email"
            placeholder="Must differ from login email"
          />
        </div>
        <div>
          <label
            htmlFor="set-avatar"
            className="block text-xs font-semibold uppercase tracking-wide text-slate-700"
          >
            Profile photo URL (optional)
          </label>
          <input
            id="set-avatar"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            className={field}
            placeholder="https://…"
            type="url"
          />
        </div>

        {msg ? (
          <p
            className={`text-sm ${msg === "Saved." ? "text-emerald-600" : "text-red-600"}`}
            role="status"
          >
            {msg}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-[#E94560] py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#c73652] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
