"use client";

import Link from "next/link";

import { Avatar } from "@/components/Avatar";

type Props = {
  name: string;
  /** Profile photo from `/auth/me` — shown when set */
  src?: string | null;
  size?: number;
  profileFilled: number;
  profileTotal?: number;
  /** Amber dot when email is not verified (password signups). */
  needsEmailVerification?: boolean;
  href?: string;
  className?: string;
};

/**
 * Avatar with a completion ring: green progress until all optional fields are set,
 * then a neutral ring only.
 */
export function ProfileAvatarBadge({
  name,
  src,
  size = 40,
  profileFilled,
  profileTotal = 6,
  needsEmailVerification = false,
  href = "/settings",
  className = "",
}: Props) {
  const complete = profileFilled >= profileTotal;
  const pct = Math.min(100, (profileFilled / profileTotal) * 100);
  const deg = (pct / 100) * 360;

  const ringStyle = complete
    ? { background: "linear-gradient(145deg, rgba(255,255,255,0.2), rgba(255,255,255,0.08))" }
    : {
        background: `conic-gradient(rgb(52 211 153) ${deg}deg, rgb(55 65 81 / 0.55) ${deg}deg)`,
      };

  const inner = (
    <span className={`relative inline-flex ${className}`}>
      <span
        className="rounded-full p-[3px] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        style={ringStyle}
      >
        <span className="block rounded-full bg-gray-900 p-0.5">
          <Avatar name={name} src={src} size={size} />
        </span>
      </span>
      {needsEmailVerification ? (
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-300 shadow-sm ring-2 ring-gray-900"
          title="Email not verified"
          aria-hidden
        />
      ) : null}
      {!complete ? (
        <span
          className="absolute -bottom-0.5 -left-0.5 h-2.5 w-2.5 rounded-full bg-slate-400 shadow-sm ring-2 ring-gray-900"
          title={`${profileFilled} of ${profileTotal} profile fields complete`}
          aria-hidden
        />
      ) : null}
    </span>
  );

  const ariaProfile =
    needsEmailVerification && !complete
      ? `Profile: email verification pending. ${profileFilled} of ${profileTotal} fields complete.`
      : needsEmailVerification
        ? "Profile: email verification pending."
        : `Profile ${profileFilled} of ${profileTotal} complete. Open profile.`;

  if (href) {
    return (
      <Link
        href={href}
        className="outline-none ring-offset-2 ring-offset-gray-900 focus-visible:ring-2 focus-visible:ring-emerald-400/80"
        aria-label={ariaProfile}
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
