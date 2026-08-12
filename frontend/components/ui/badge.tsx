import type { HTMLAttributes, ReactNode } from "react";

type Tone = "primary" | "muted" | "success" | "warning" | "error";

const toneClass: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary",
  muted: "border border-border bg-app text-muted",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-error/10 text-error",
};

type Props = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: Tone;
};

export function Badge({ children, tone = "primary", className = "", ...rest }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold ${toneClass[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
