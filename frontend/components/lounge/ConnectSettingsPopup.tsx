"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, X, Shield, Ban, Smartphone, Bell, Link2 } from "lucide-react";
import { requestCallNotificationPermission } from "@/lib/lounge/call-notifications";
import { apiFetch } from "@/lib/api";

type BlockedUser = {
  id: string;
  full_name: string;
  username?: string | null;
};

type ConnectSettingsPopupProps = {
  onClose: () => void;
  onToast: (msg: string) => void;
};

export function ConnectSettingsPopup({ onClose, onToast }: ConnectSettingsPopupProps) {
  const [screen, setScreen] = useState<"main" | "privacy" | "blocked" | "devices" | "notifications">("main");
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifEnabled(Notification.permission === "granted");
    }
  }, []);

  useEffect(() => {
    apiFetch<{ preferences?: { connect?: { privacy?: { read_receipts?: boolean } } } }>(
      "/settings/app",
    )
      .then((data) => {
        setReadReceipts(data.preferences?.connect?.privacy?.read_receipts ?? true);
      })
      .catch(() => {});
  }, []);

  const loadBlocked = useCallback(() => {
    setLoadingBlocked(true);
    apiFetch<BlockedUser[]>("/social/blocked")
      .then(setBlocked)
      .catch(() => onToast("Could not load blocked users"))
      .finally(() => setLoadingBlocked(false));
  }, [onToast]);

  useEffect(() => {
    if (screen === "blocked") loadBlocked();
  }, [screen, loadBlocked]);

  const patchReadReceipts = async (enabled: boolean) => {
    setReadReceipts(enabled);
    setSaving(true);
    try {
      await apiFetch("/settings/app", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: { connect: { privacy: { read_receipts: enabled } } },
        }),
      });
      onToast(enabled ? "Read receipts enabled" : "Read receipts disabled");
    } catch {
      setReadReceipts(!enabled);
      onToast("Could not save setting");
    } finally {
      setSaving(false);
    }
  };

  const unblock = async (userId: string) => {
    try {
      await apiFetch(`/social/block/${userId}`, { method: "DELETE" });
      setBlocked((prev) => prev.filter((u) => u.id !== userId));
      onToast("User unblocked");
    } catch {
      onToast("Could not unblock user");
    }
  };

  const header = (title: string, back?: () => void) => (
    <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-3">
      <div className="flex items-center gap-1.5">
        {back ? (
          <button type="button" onClick={back} className="p-0.5 text-stone-400">
            <ChevronLeft size={16} className="text-[#0F766E]" />
          </button>
        ) : null}
        <span className="text-xs font-bold text-[#0F766E]">{title}</span>
      </div>
      <button type="button" onClick={onClose} className="p-1 text-stone-400">
        <X size={14} />
      </button>
    </div>
  );

  if (screen === "privacy") {
    return (
      <div className="p-3 text-slate-900">
        {header("Privacy", () => setScreen("main"))}
        <label className="flex items-center justify-between py-2 text-xs">
          <span className="font-semibold text-slate-700">Read receipts</span>
          <input
            type="checkbox"
            checked={readReceipts}
            disabled={saving}
            onChange={(e) => void patchReadReceipts(e.target.checked)}
            className="h-4 w-4 rounded text-[#0F766E]"
          />
        </label>
        <p className="text-[10px] text-stone-500 leading-relaxed">
          When off, you won&apos;t send or receive read receipts in direct chats.
        </p>
      </div>
    );
  }

  if (screen === "blocked") {
    return (
      <div className="p-3 text-slate-900">
        {header("Blocked", () => setScreen("main"))}
        {loadingBlocked ? (
          <p className="py-4 text-center text-xs text-stone-500">Loading...</p>
        ) : blocked.length === 0 ? (
          <p className="py-4 text-center text-xs text-stone-500">No blocked users</p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {blocked.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-2.5 py-2">
                <span className="text-xs font-semibold text-slate-900">{u.full_name}</span>
                <button
                  type="button"
                  onClick={() => void unblock(u.id)}
                  className="text-[10px] font-bold text-[#0F766E]"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (screen === "notifications") {
    return (
      <div className="p-3 text-slate-900">
        {header("Notifications", () => setScreen("main"))}
        <label className="flex items-center justify-between py-2 text-xs">
          <span className="font-semibold text-slate-700">Call notifications</span>
          <input
            type="checkbox"
            checked={notifEnabled}
            onChange={async (e) => {
              if (e.target.checked) {
                const ok = await requestCallNotificationPermission();
                setNotifEnabled(ok);
                onToast(ok ? "Notifications enabled" : "Permission denied");
              } else {
                onToast("Disable notifications in browser site settings");
              }
            }}
            className="h-4 w-4 rounded text-[#0F766E]"
          />
        </label>
        <p className="text-[10px] text-stone-500 leading-relaxed">
          Get alerted for incoming audio and video calls when Rovvy is in the background.
        </p>
      </div>
    );
  }

  if (screen === "devices") {
    return (
      <div className="p-3 text-slate-900">
        {header("Linked devices", () => setScreen("main"))}
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-center">
          <Smartphone className="mx-auto h-8 w-8 text-stone-400" />
          <p className="mt-2 text-xs font-semibold text-slate-800">This browser session</p>
          <p className="mt-1 text-[10px] text-stone-500">
            Multi-device sync uses the same Firebase account. Open Rovvy on another device while logged in to link it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 text-slate-900 space-y-1">
      {header("Connect settings")}
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(`${window.location.origin}/join`);
            onToast("Invite link copied");
          } catch {
            onToast("Could not copy link");
          }
        }}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-teal-50"
      >
        <Link2 size={14} className="text-[#0F766E]" /> Share invite link
      </button>
      <button
        type="button"
        onClick={() => setScreen("notifications")}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-teal-50"
      >
        <Bell size={14} className="text-[#0F766E]" /> Notifications
      </button>
      <button
        type="button"
        onClick={() => setScreen("privacy")}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-teal-50"
      >
        <Shield size={14} className="text-[#0F766E]" /> Privacy
      </button>
      <button
        type="button"
        onClick={() => setScreen("blocked")}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-teal-50"
      >
        <Ban size={14} className="text-[#0F766E]" /> Blocked users
      </button>
      <button
        type="button"
        onClick={() => setScreen("devices")}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-teal-50"
      >
        <Smartphone size={14} className="text-[#0F766E]" /> Linked devices
      </button>
    </div>
  );
}
