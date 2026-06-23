"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Calendar,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MoreVertical,
  ShoppingCart,
  User,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { IconBell } from "@/components/icons";
import { emitOpenLounge } from "@/lib/open-lounge";

type MenuItem = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  tone?: "default" | "danger";
};

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
  const router = useRouter();
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

  const overflowItems: MenuItem[] = showOverflowItems
    ? [
        {
          label: "Plan a Trip",
          icon: Calendar,
          onClick: () => {
            router.push("/trips/plan");
            close();
          },
        },
        {
          label: "Rovvy Lounge",
          icon: MessageSquare,
          onClick: () => {
            emitOpenLounge();
            close();
          },
        },
        {
          label: "My Stats",
          icon: MoreVertical,
          onClick: () => {
            router.push("/stats");
            close();
          },
        },
        {
          label: "Settings",
          icon: MoreVertical,
          onClick: () => {
            router.push("/settings");
            close();
          },
        },
        {
          label: "Ask AI Assistant",
          icon: Bot,
          onClick: () => {
            window.dispatchEvent(new CustomEvent("open-ai-sidecar"));
            close();
          },
        },
      ]
    : [];

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
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F766E] text-sm font-bold text-white ring-2 ring-[#0F766E]/15">
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
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-stone-200 bg-white py-1.5 text-[13px] font-medium text-stone-700 shadow-xl"
        >
          <Link
            href="/profile"
            role="menuitem"
            onClick={close}
            className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-stone-50"
          >
            <User size={15} className="text-[#0F766E]" />
            <span>My Profile</span>
          </Link>
          <Link
            href="/notifications"
            role="menuitem"
            onClick={close}
            className="flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-stone-50"
          >
            <span className="flex items-center gap-2.5">
              <IconBell size={15} className="text-[#0F766E]" />
              Notifications
            </span>
            {notifCount > 0 ? (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {notifCount > 99 ? "99" : notifCount}
              </span>
            ) : null}
          </Link>
          <Link
            href="/cart"
            role="menuitem"
            onClick={close}
            className="flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-stone-50"
          >
            <span className="flex items-center gap-2.5">
              <ShoppingCart size={15} className="text-[#0F766E]" />
              Travel Cart
            </span>
            {cartCount > 0 ? (
              <span className="rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {cartCount > 99 ? "99" : cartCount}
              </span>
            ) : null}
          </Link>

          <div className="mx-3 my-1 border-t border-stone-100" />

          <Link
            href="/dashboard"
            role="menuitem"
            onClick={close}
            className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-stone-50"
          >
            <LayoutDashboard size={15} className="text-[#0F766E]" />
            Dashboard
          </Link>

          {overflowItems.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={item.onClick}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-stone-50"
            >
              <item.icon size={15} className="text-[#0F766E]" />
              {item.label}
            </button>
          ))}

          <div className="mx-3 my-1 border-t border-stone-100" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onLogout();
            }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-red-600 hover:bg-red-50"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
