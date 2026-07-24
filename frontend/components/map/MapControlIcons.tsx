"use client";

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

/** Google Maps–style stacked map layers (Material "layers"). */
export function MapLayersIcon({ size = 20, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      {...props}
    >
      <path
        d="M12 3L3 8.5L12 14L21 8.5L12 3Z"
        fill="currentColor"
        fillOpacity={0.28}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M3 12.5L12 18L21 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 16.5L12 22L21 16.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Google Maps "My Location" crosshair target (Material "my_location"). */
export function MyLocationIcon({ size = 20, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      {...props}
    >
      <circle cx="12" cy="12" r="6.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path
        d="M12 3V6M12 18V21M3 12H6M18 12H21"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Lucide-compatible wrapper for the bottom Explore tab. */
export function ExploreTabIcon({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const active = Boolean(className?.includes("0F766E"));
  return <ExploreNavIcon size={size} active={active} className={className} />;
}

/** Google Maps bottom-tab Explore (Material "explore" — compass in circle). */
export function ExploreNavIcon({
  size = 22,
  className,
  active = false,
  ...props
}: IconProps & { active?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="9.25"
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.65}
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.14 : 0}
      />
      <path
        d="M14.2 9.8L10.4 13.6L9.8 10.4L13.6 9.8L14.2 9.8Z"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 7.5V8.8M12 15.2V16.5M7.5 12H8.8M15.2 12H16.5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        opacity={active ? 0.85 : 0.55}
      />
    </svg>
  );
}
