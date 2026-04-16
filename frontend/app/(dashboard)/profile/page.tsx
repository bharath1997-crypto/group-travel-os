"use client";

import Link from "next/link";

/**
 * Profile hub — account details live in Settings.
 * Route required for dashboard nav (/profile).
 */
export default function ProfilePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#0F3460]">Profile</h1>
      <p className="mt-2 text-sm text-[#6C757D]">
        Update your name, avatar, and preferences in Settings.
      </p>
      <Link
        href="/settings"
        className="mt-4 inline-flex rounded-lg bg-[#E94560] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
      >
        Open settings →
      </Link>
    </div>
  );
}
