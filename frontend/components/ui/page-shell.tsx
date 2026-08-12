import type { ReactNode } from "react";
import Link from "next/link";

type Breadcrumb = { label: string; href?: string };

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: Breadcrumb[];
  wide?: boolean;
};

export function PageHeader({ title, description, actions, breadcrumbs, wide }: Props) {
  return (
    <header className="rovvy-page-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
                {index > 0 ? <span aria-hidden>/</span> : null}
                {crumb.href ? (
                  <Link href={crumb.href} className="font-medium hover:text-primary">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-medium text-text">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="rovvy-page-title">{title}</h1>
        {description ? <p className="rovvy-page-description">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

type ShellProps = {
  children: ReactNode;
  wide?: boolean;
  className?: string;
};

export function PageShell({ children, wide, className = "" }: ShellProps) {
  return (
    <div
      className={`${wide ? "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8" : "rovvy-page-shell"} ${className}`}
    >
      {children}
    </div>
  );
}
