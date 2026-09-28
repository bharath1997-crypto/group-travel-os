import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover shadow-sm focus-visible:outline-primary",
  secondary:
    "border border-border bg-card text-text hover:bg-app shadow-sm focus-visible:outline-primary",
  ghost: "text-text hover:bg-app focus-visible:outline-primary",
  danger:
    "bg-error text-white hover:bg-error/90 shadow-sm focus-visible:outline-error",
};

const sizeClass: Record<Size, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-base",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  children,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-control font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
