"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { emitOpenLounge, type OpenLoungeDetail } from "@/lib/open-lounge";

type OpenLoungeButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  detail?: OpenLoungeDetail;
  children: ReactNode;
};

/** Opens the independent Rovvy Lounge dock — use instead of linking to /travel-hub. */
export function OpenLoungeButton({
  detail,
  children,
  type = "button",
  onClick,
  ...props
}: OpenLoungeButtonProps) {
  return (
    <button
      type={type}
      {...props}
      onClick={(e) => {
        emitOpenLounge(detail);
        onClick?.(e);
      }}
    >
      {children}
    </button>
  );
}
