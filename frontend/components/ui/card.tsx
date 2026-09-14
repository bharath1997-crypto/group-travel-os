import type { HTMLAttributes, ReactNode } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  padding?: "none" | "sm" | "md";
  interactive?: boolean;
};

const paddingClass = {
  none: "",
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-5",
};

export function Card({
  children,
  className = "",
  padding = "md",
  interactive = false,
  ...rest
}: Props) {
  return (
    <div
      className={`rounded-card border border-border bg-card shadow-card ${
        interactive
          ? "transition hover:border-primary/25 hover:shadow-panel"
          : ""
      } ${paddingClass[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
