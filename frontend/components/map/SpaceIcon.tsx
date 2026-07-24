"use client";

type Props = {
  size?: number;
  className?: string;
};

/** Personal Space — soft orbit bubble (not an app grid). */
export function SpaceIcon({ size = 22, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="8.25"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.45"
      />
      <circle cx="12" cy="12" r="3.25" fill="currentColor" fillOpacity="0.22" />
      <circle cx="12" cy="12" r="1.65" fill="currentColor" />
      <circle cx="17.25" cy="8.25" r="1.35" fill="currentColor" />
    </svg>
  );
}
