"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { AppPreferences } from "@/lib/app-settings";
import { fetchAppSettings, patchAppSettings, prefSection } from "@/lib/app-settings";
import { apiFetch } from "@/lib/api";
import { clearToken } from "@/lib/auth";

import {
  SettingsScreenHeader,
  SettingsSectionTitle,
  SettingsToggleRow,
} from "../_components";

export default function SettingsSecurityPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<AppPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [delPwd, setDelPwd] = useState("");
  const [delConfirm, setDelConfirm] = useState("");
  const [delMsg, setDelMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const b = await fetchAppSettings();
    setPrefs(b.preferences);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (id) {
      window.requestAnimationFrame(() =>
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }),
      );
    }
  }, [prefs]);

  async function merge(patch: AppPreferences) {
    setBusy(true);
    try {
      const b = await patchAppSettings(patch);
      setPrefs(b.preferences);
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          old_password: oldPwd,
          new_password: newPwd,
        }),
      });
      setPwdMsg("Password updated.");
      setOldPwd("");
      setNewPwd("");
    } catch (err) {
      setPwdMsg(err instanceof Error ? err.message : "Could not update");
    }
  }

  async function submitDelete(e: React.FormEvent) {
    e.preventDefault();
    setDelMsg(null);
    try {
      await apiFetch("/auth/account/deactivate", {
        method: "POST",
        body: JSON.stringify({
          confirmation: delConfirm,
          password: delPwd.trim() || null,
        }),
      });
      clearToken();
      router.push("/login");
    } catch (err) {
      setDelMsg(err instanceof Error ? err.message : "Could not deactivate");
    }
  }

  if (!prefs) {
    return (
      <>
        <SettingsScreenHeader title="Security" backHref="/settings/account" />
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-[#E94560]" />
        </div>
      </>
    );
  }

  const s = prefSection<Record<string, unknown>>(prefs, "security");
  const a = prefSection<Record<string, unknown>>(prefs, "appearance");
  const theme = String(a.theme ?? "system");

  return (
    <>
      <SettingsScreenHeader title="Security" backHref="/settings/account" />
      <div id="password" className="scroll-mt-16 px-4 py-4">
        <SettingsSectionTitle>Password</SettingsSectionTitle>
        <form onSubmit={submitPassword} className="mt-2 space-y-3">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Current password"
            value={oldPwd}
            onChange={(e) => setOldPwd(e.target.value)}
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New password (min 8 chars)"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
          />
          {pwdMsg ? (
            <p
              className={`text-sm ${pwdMsg.includes("updated") ? "text-emerald-600" : "text-red-600"}`}
            >
              {pwdMsg}
            </p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-xl bg-[#E94560] py-2.5 text-sm font-semibold text-white"
          >
            Update password
          </button>
        </form>
        <p className="mt-2 text-xs text-stone-500">
          OAuth-only accounts can skip password changes — use your provider’s
          security settings.
        </p>
      </div>
      <div className="px-4">
        <SettingsToggleRow
          label="Two-factor authentication"
          sublabel="Pilot flag — wire your authenticator provider next"
          checked={Boolean(s.two_factor_enabled)}
          busy={busy}
          onToggle={(v) =>
            void merge({ security: { two_factor_enabled: v } })
          }
        />
        <SettingsToggleRow
          label="Lock screen shortcut"
          sublabel="Show quick trip actions on supported devices"
          checked={Boolean(s.lockscreen_shortcut)}
          busy={busy}
          onToggle={(v) =>
            void merge({ security: { lockscreen_shortcut: v } })
          }
        />
        <SettingsToggleRow
          label="Remember login on this device"
          checked={Boolean(s.saved_login_enabled)}
          busy={busy}
          onToggle={(v) =>
            void merge({ security: { saved_login_enabled: v } })
          }
        />
      </div>
      <div className="border-b border-stone-100 px-4 py-3">
        <p className="text-[15px] font-medium text-neutral-900">Appearance</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["system", "System"],
              ["light", "Light"],
              ["dark", "Dark"],
            ] as const
          ).map(([v, lab]) => (
            <button
              key={v}
              type="button"
              disabled={busy}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                theme === v
                  ? "bg-[#E94560] text-white"
                  : "bg-stone-100 text-stone-700"
              }`}
              onClick={() => void merge({ appearance: { theme: v } })}
            >
              {lab}
            </button>
          ))}
        </div>
      </div>
      <div id="delete" className="scroll-mt-16 px-4 py-6">
        <SettingsSectionTitle>Delete account</SettingsSectionTitle>
        <p className="text-sm text-stone-600">
          Soft-deactivates your login. Type <strong>DELETE</strong> to confirm.
          Email/password accounts must enter their password; Google/Facebook
          users omit it.
        </p>
        <form onSubmit={submitDelete} className="mt-3 space-y-3">
          <input
            value={delConfirm}
            onChange={(e) => setDelConfirm(e.target.value)}
            placeholder='Type DELETE'
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={delPwd}
            onChange={(e) => setDelPwd(e.target.value)}
            placeholder="Password (if applicable)"
            autoComplete="current-password"
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
          />
          {delMsg ? <p className="text-sm text-red-600">{delMsg}</p> : null}
          <button
            type="submit"
            className="w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-700"
          >
            Deactivate account
          </button>
        </form>
      </div>
    </>
  );
}
