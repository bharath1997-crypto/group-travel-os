"use client";

import { useCallback, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ChevronLeft, Copy, Share2 } from "lucide-react";
import {
  buildProfileConnectUrl,
  profileHandleLabel,
} from "@/lib/lounge/profile-share";

type ProfileQrSheetProps = {
  userId: string;
  displayName: string;
  username?: string | null;
  initials: string;
  avatarColor: string;
  onClose: () => void;
  showToast: (m: string, t?: "success" | "error") => void;
  variant?: "dock" | "fullscreen";
};

export function ProfileQrSheet({
  userId,
  displayName,
  username,
  initials,
  avatarColor,
  onClose,
  showToast,
  variant = "fullscreen",
}: ProfileQrSheetProps) {
  const [copied, setCopied] = useState(false);
  const profileUrl = useMemo(
    () => buildProfileConnectUrl(userId, username),
    [userId, username],
  );
  const handle = profileHandleLabel(username);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      showToast("Profile link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Could not copy link", "error");
    }
  }, [profileUrl, showToast]);

  const onShare = useCallback(async () => {
    const payload = {
      title: `${displayName} on Rovvy`,
      text: `Connect with ${displayName} on Rovvy`,
      url: profileUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
      } else {
        await onCopy();
      }
    } catch {
      /* user cancelled */
    }
  }, [displayName, onCopy, profileUrl]);

  const isDock = variant === "dock";

  return (
    <div
      className={
        isDock
          ? "absolute inset-0 z-20 flex flex-col overflow-hidden bg-white"
          : "fixed inset-0 z-[390] flex flex-col bg-white"
      }
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-[#e5e7eb] px-3 py-2.5">
        <button
          type="button"
          aria-label="Back"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5"
        >
          <ChevronLeft size={18} className="text-[#1E293B]" />
        </button>
        <h2 className="flex-1 text-sm font-bold text-[#1E293B]">Profile QR</h2>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-5 py-6">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold text-white"
          style={{ background: avatarColor }}
        >
          {initials}
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-[#1E293B]">{displayName}</p>
          {handle ? (
            <p className="mt-0.5 text-xs text-[#6b7280]">{handle}</p>
          ) : null}
          <p className="mt-2 max-w-[260px] text-[11px] leading-relaxed text-[#6b7280]">
            Scan to view this profile and send a connect request on Rovvy.
          </p>
        </div>

        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
          <QRCodeSVG
            value={profileUrl}
            size={isDock ? 200 : 240}
            level="M"
            includeMargin
            bgColor="#ffffff"
            fgColor="#1E293B"
          />
        </div>

        <p className="max-w-[280px] break-all text-center text-[10px] text-[#9ca3af]">
          {profileUrl}
        </p>

        <div className="flex w-full max-w-[280px] gap-2">
          <button
            type="button"
            onClick={() => void onCopy()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#e5e7eb] py-2.5 text-xs font-semibold text-[#1E293B] hover:bg-[#f9fafb]"
          >
            <Copy size={14} />
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={() => void onShare()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-bold text-white"
          >
            <Share2 size={14} />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
