import type { ReactNode } from "react";

type GradientHeaderProps = {
  gradient: string;
  title: string;
  subtitle: string;
  height: number;
  /** Optional logo or extra content above the title line */
  children?: ReactNode;
};

export function GradientHeader({
  gradient,
  title,
  subtitle,
  height,
  children,
}: GradientHeaderProps) {
  return (
    <header
      className="relative flex w-full flex-shrink-0 flex-col items-center justify-center overflow-hidden rounded-b-3xl px-4 pb-6 pt-8 text-center text-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)]"
      style={{ background: gradient, minHeight: height }}
    >
      {children}
      {title ? (
        <p className="mt-3 text-xs font-bold tracking-[0.35em] text-white/95">{title}</p>
      ) : null}
      <p className="mt-2 max-w-sm text-sm font-medium leading-snug text-white/95">{subtitle}</p>
    </header>
  );
}
