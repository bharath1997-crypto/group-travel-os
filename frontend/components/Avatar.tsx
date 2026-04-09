"use client";

import { useState } from "react";

const FALLBACK_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
] as const;

function fallbackBg(name: string): string {
  const t = name.trim();
  const code = t.length ? t.charCodeAt(0) : 0;
  return FALLBACK_COLORS[code % 6];
}

function fallbackLetter(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t.charAt(0).toUpperCase();
}

export type AvatarProps = {
  name: string;
  size?: number;
  className?: string;
};

export function Avatar({ name, size = 40, className = "" }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const src = `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(name)}`;

  if (failed) {
    return (
      <div
        className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 border-white shadow-sm font-semibold text-white ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor: fallbackBg(name),
          fontSize: Math.max(12, size * 0.4),
        }}
        role="img"
        aria-hidden
      >
        {fallbackLetter(name)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-full border-2 border-white object-cover shadow-sm ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
