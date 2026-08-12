"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ProfileAccountMenuPanel } from "@/components/ProfileAccountMenuPanel";

interface HeaderProfileMenuProps {
  displayName?: string | null;
  avatarUrl?: string | null;
  cartCount?: number;
  notifCount?: number;
  onLogout: () => void;
  showOverflowItems?: boolean;
}

function initialsFromName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

export function HeaderProfileMenu({
  displayName,
  avatarUrl,
  cartCount = 0,
  notifCount = 0,
  onLogout,
  showOverflowItems = false,
}: HeaderProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const close = () => setOpen(false);
  const badgeTotal = cartCount + notifCount;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-xl p-1 hover:bg-stone-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]/40"
        aria-label="Profile menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="relative">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-9 w-9 rounded-full object-cover ring-2 ring-[#0F766E]/15"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white ring-2 ring-[#0F766E]/15">
              {initialsFromName(displayName)}
            </span>
          )}
          {badgeTotal > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
          ) : null}
        </span>
        <ChevronDown
          size={14}
          className={`text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-52">
          <ProfileAccountMenuPanel
            displayName={displayName}
            cartCount={cartCount}
            notifCount={notifCount}
            onLogout={onLogout}
            onNavigate={close}
            showOverflowItems={showOverflowItems}
            className="shadow-xl"
          />
        </div>
      ) : null}
    </div>
  );
}
