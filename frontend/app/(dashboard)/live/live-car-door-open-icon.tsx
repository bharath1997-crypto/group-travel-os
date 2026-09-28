import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & {
  size?: number;
};

/** Side-view car with the near-side rear door swung open (rideshare / pickup). */
export function CarSideDoorOpenIcon({
  size = 16,
  className,
  ...props
}: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h2.5" />
      <circle cx="17" cy="17" r="2" />
      <path d="M10.5 10.5v4.5" />
      <path d="M10.5 10.5 7 8.5" />
      <path d="M10.5 15 7 13.5" />
    </svg>
  );
}
