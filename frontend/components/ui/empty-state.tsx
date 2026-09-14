import type { ReactNode } from "react";
import { Button } from "./button";

type Props = {
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
};

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-card px-6 py-12 text-center">
      {icon ? <div className="mb-4 text-muted">{icon}</div> : null}
      <h2 className="font-display text-lg font-semibold text-text">{title}</h2>
      {description ? <p className="mt-2 max-w-md text-sm text-muted">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" role="status" aria-live="polite">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-primary"
        aria-hidden
      />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-card border border-error/20 bg-error/5 px-5 py-8 text-center">
      <h2 className="font-display text-lg font-semibold text-text">{title}</h2>
      {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
      {onRetry ? (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
