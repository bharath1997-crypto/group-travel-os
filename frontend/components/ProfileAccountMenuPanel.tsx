"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Calendar,
  LayoutDashboard,
  LogOut,
  MoreVertical,
  ShoppingCart,
  User,
  type LucideIcon,
} from "lucide-react";

import { IconBell } from "@/components/icons";
import { SpaceIcon } from "@/components/map/SpaceIcon";
import { emitOpenLounge } from "@/lib/open-lounge";

type MenuItem = {
  label: string;
  icon?: LucideIcon;
  spaceIcon?: boolean;
  onClick: () => void;
};

export type ProfileAccountMenuPanelProps = {
  displayName?: string | null;
  cartCount?: number;
  notifCount?: number;
  onLogout: () => void;
  onNavigate?: () => void;
  showOverflowItems?: boolean;
  className?: string;
};

/** Shared profile / account links — header (desktop) and Lounge Connect (mobile). */
export function ProfileAccountMenuPanel({
  displayName,
  cartCount = 0,
  notifCount = 0,
  onLogout,
  onNavigate,
  showOverflowItems = true,
  className = "",
}: ProfileAccountMenuPanelProps) {
  const router = useRouter();

  const close = () => onNavigate?.();

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
          spaceIcon: true,
          onClick: () => {
            emitOpenLounge({ openTab: "updates" });
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

  return (
    <nav
      className={`overflow-hidden rounded-xl border border-stone-200 bg-white py-1.5 text-[13px] font-medium text-stone-700 shadow-sm ${className}`}
      aria-label={`Account menu${displayName ? ` for ${displayName}` : ""}`}
    >
      <Link
        href="/profile"
        onClick={close}
        className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-stone-50"
      >
        <User size={15} className="text-primary" />
        <span>My Profile</span>
      </Link>
      <Link
        href="/notifications"
        onClick={close}
        className="flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-stone-50"
      >
        <span className="flex items-center gap-2.5">
          <IconBell size={15} className="text-primary" />
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
        onClick={close}
        className="flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-stone-50"
      >
        <span className="flex items-center gap-2.5">
          <ShoppingCart size={15} className="text-primary" />
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
        onClick={close}
        className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-stone-50"
      >
        <LayoutDashboard size={15} className="text-primary" />
        Dashboard
      </Link>

      {overflowItems.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-stone-50"
        >
          {item.spaceIcon ? (
            <SpaceIcon size={15} className="text-primary" />
          ) : item.icon ? (
            <item.icon size={15} className="text-primary" />
          ) : null}
          {item.label}
        </button>
      ))}

      <div className="mx-3 my-1 border-t border-stone-100" />

      <button
        type="button"
        onClick={() => {
          close();
          onLogout();
        }}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-red-600 hover:bg-red-50"
      >
        <LogOut size={15} />
        Sign out
      </button>
    </nav>
  );
}
