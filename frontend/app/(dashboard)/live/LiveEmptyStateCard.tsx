"use client";

import type { ReactNode } from "react";
import { LIVE_DOCK_PRIMARY_CTA, LIVE_DOCK_SECTION_LABEL } from "./live-design-tokens";

export type LiveEmptyStateVariant =
  | "no_results"
  | "approximate_gps"
  | "no_land_route"
  | "no_friends"
  | "offline";

type LiveEmptyStateCardProps = {
  variant: LiveEmptyStateVariant;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
};

function EmptyIcon({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto mb-2.5 flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#F1EFE8] text-[#5F665F]">
      {children}
    </div>
  );
}

export default function LiveEmptyStateCard({
  variant,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = "",
}: LiveEmptyStateCardProps) {
  if (variant === "offline") {
    return (
      <div
        className={`flex items-center gap-3 rounded-2xl border border-[rgba(15,22,20,0.06)] bg-[#F1EFE8] px-4 py-3.5 ${className}`}
      >
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-[#3A423B]">
          <strong className="font-semibold">Offline.</strong>{" "}
          {description ?? "Map is cached, ETAs paused until you're back online."}
        </p>
        <span className={`shrink-0 ${LIVE_DOCK_SECTION_LABEL}`}>Stale</span>
      </div>
    );
  }

  const resolved = resolveEmptyStateCopy(variant, title, description, actionLabel);

  const isDanger = variant === "no_land_route";

  return (
    <div
      className={`rounded-2xl border bg-white px-4 py-4 text-center ${
        isDanger ? "border-[rgba(180,69,61,0.3)]" : "border-[rgba(15,22,20,0.08)]"
      } ${className}`}
    >
      {variant === "approximate_gps" ? (
        <div className="mb-2 flex items-center justify-center gap-2.5 text-left">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#8D6A1E]" aria-hidden />
          <span className="text-[13.5px] font-semibold text-[#0F1614]">{resolved.title}</span>
        </div>
      ) : variant === "no_friends" ? (
        <div className="mb-2.5 flex justify-center">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#FBFAF7] bg-[#F1EFE8] text-[10px] font-bold text-[#5F665F]">
            ?
          </span>
          <span className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#FBFAF7] bg-[#F1EFE8] text-[10px] font-bold text-[#5F665F]">
            ?
          </span>
        </div>
      ) : (
        <EmptyIcon>
          {variant === "no_results" ? (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l4 4" />
            </svg>
          ) : null}
        </EmptyIcon>
      )}

      {variant !== "approximate_gps" ? (
        <h4
          className={`font-serif text-lg leading-tight ${
            isDanger ? "font-semibold text-[#B4453D]" : "text-[#0F1614]"
          }`}
        >
          {resolved.title}
        </h4>
      ) : null}

      <p className="mt-1.5 text-xs leading-relaxed text-[#5F665F]">{resolved.description}</p>

      {resolved.actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className={
            variant === "no_friends"
              ? `mt-3 ${LIVE_DOCK_PRIMARY_CTA} !w-auto px-4 py-2 text-xs`
              : variant === "approximate_gps"
                ? "mt-3 rounded-full border border-[#0F1614] bg-transparent px-4 py-2 text-xs font-semibold text-[#0F1614] transition hover:bg-[#0F1614] hover:text-white"
                : variant === "no_results"
                  ? "mt-3 rounded-full border border-[rgba(14,110,92,0.3)] bg-white px-4 py-2 text-xs font-semibold text-[#0E6E5C]"
                  : "mt-3 rounded-full border border-[rgba(15,22,20,0.16)] bg-white px-4 py-2 text-xs font-semibold text-[#0F1614] transition hover:border-[#0F1614]"
          }
        >
          {resolved.actionLabel}
        </button>
      ) : null}

      {secondaryActionLabel && onSecondaryAction ? (
        <button
          type="button"
          onClick={onSecondaryAction}
          className="mt-2 text-[11px] font-semibold text-[#0E6E5C] hover:underline"
        >
          {secondaryActionLabel}
        </button>
      ) : null}
    </div>
  );
}

function resolveEmptyStateCopy(
  variant: LiveEmptyStateVariant,
  title?: string,
  description?: string,
  actionLabel?: string,
) {
  switch (variant) {
    case "no_results":
      return {
        title: title ?? "Nothing open in this square",
        description:
          description ?? "Pan the map or widen your search — more places may match nearby.",
        actionLabel: actionLabel ?? "Widen search",
      };
    case "approximate_gps":
      return {
        title: title ?? "Location is approximate",
        description:
          description ??
          "GPS is off, so this is your city not your street. We check where you are — we don't keep it.",
        actionLabel: actionLabel ?? "Use exact location",
      };
    case "no_land_route":
      return {
        title: title ?? "Can't drive there",
        description:
          description ??
          "No land route to this pin. Try Air or Ship, or pick a mainland meet point.",
        actionLabel: actionLabel ?? "Pick a meet point",
      };
    case "no_friends":
      return {
        title: title ?? "No one's sharing yet",
        description:
          description ??
          "Friends appear here the moment they go live. Nobody sees you unless you share back.",
        actionLabel: actionLabel ?? "Invite the group",
      };
    default:
      return { title: title ?? "", description: description ?? "", actionLabel };
  }
}

/** Compact stack for left dock — renders applicable cards only. */
export function LiveDockEmptyStates({
  isOnline,
  gpsStatus,
  routePreviewStatus,
  routePreviewError,
  workflowType,
  onRequestExactLocation,
  onPickMeetPoint,
  onInviteGroup,
  className = "",
}: {
  isOnline: boolean;
  gpsStatus: string;
  routePreviewStatus: "idle" | "loading" | "ready" | "failed";
  routePreviewError: string | null;
  workflowType: "Solo" | "Group Travel" | "Seat Share";
  onRequestExactLocation: () => void;
  onPickMeetPoint: () => void;
  onInviteGroup: () => void;
  className?: string;
}) {
  const cards: ReactNode[] = [];

  if (!isOnline) {
    cards.push(
      <LiveEmptyStateCard key="offline" variant="offline" className="text-left" />,
    );
  }

  if (gpsStatus === "approximate" || gpsStatus === "denied" || gpsStatus === "error") {
    cards.push(
      <LiveEmptyStateCard
        key="gps"
        variant="approximate_gps"
        className="text-left"
        onAction={onRequestExactLocation}
      />,
    );
  }

  if (
    routePreviewStatus === "failed" &&
    routePreviewError &&
    /no route|land route|can't drive|cannot drive/i.test(routePreviewError)
  ) {
    cards.push(
      <LiveEmptyStateCard
        key="route"
        variant="no_land_route"
        description={routePreviewError}
        className="text-left"
        onAction={onPickMeetPoint}
      />,
    );
  }

  if (workflowType === "Group Travel") {
    cards.push(
      <LiveEmptyStateCard
        key="friends"
        variant="no_friends"
        className="text-left"
        onAction={onInviteGroup}
      />,
    );
  }

  if (cards.length === 0) return null;

  return <div className={`mt-2 space-y-2.5 ${className}`}>{cards}</div>;
}
