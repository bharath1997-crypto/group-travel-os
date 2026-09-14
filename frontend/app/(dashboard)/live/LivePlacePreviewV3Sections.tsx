"use client";

import { ThumbsUp, Users, UtensilsCrossed } from "lucide-react";
import PlacePreviewMedia from "./PlacePreviewMedia";
import type { PlaceMediaItem } from "./live-place-media";

type LivePlacePreviewHeroProps = {
  placeMedia: PlaceMediaItem[];
  placeMediaLoading: boolean;
  categoryLabel: string;
  onClose: () => void;
};

export function LivePlacePreviewHero({
  placeMedia,
  placeMediaLoading,
  categoryLabel,
  onClose,
}: LivePlacePreviewHeroProps) {
  return (
    <div className="relative -mx-3 -mt-2.5 mb-3 overflow-hidden rounded-t-xl">
      <div className="max-h-[11rem] overflow-hidden">
        <PlacePreviewMedia
          media={placeMedia}
          categoryLabel={categoryLabel}
          loading={placeMediaLoading}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/95 to-transparent"
        aria-hidden
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/50"
        aria-label="Close place preview"
      >
        ×
      </button>
    </div>
  );
}

type LivePlacePreviewGroupSectionProps = {
  categoryLabel: string;
  onPutToVote?: () => void;
  onInviteGroup?: () => void;
  onReserve?: () => void;
};

function isFoodCategory(categoryLabel: string): boolean {
  return /coffee|cafe|restaurant|bar|food|bakery|bistro|diner|pub/i.test(categoryLabel);
}

export function LivePlacePreviewGroupSection({
  categoryLabel,
  onPutToVote,
  onInviteGroup,
  onReserve,
}: LivePlacePreviewGroupSectionProps) {
  const showReserve = isFoodCategory(categoryLabel);

  return (
    <div className="mb-3 space-y-3 border-b border-stone-100 pb-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPutToVote}
          className="inline-flex flex-1 min-w-[8rem] items-center justify-center gap-1.5 rounded-full border border-[rgba(14,110,92,0.28)] bg-white px-3 py-2 text-xs font-semibold text-[#0E6E5C] transition hover:bg-[#F6F4EF]"
        >
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
          Put to vote
        </button>
        {showReserve ? (
          <button
            type="button"
            onClick={onReserve}
            className="inline-flex flex-1 min-w-[8rem] items-center justify-center gap-1.5 rounded-full border border-[rgba(15,22,20,0.12)] bg-white px-3 py-2 text-xs font-semibold text-[#0F1614] transition hover:border-[#0F1614]"
          >
            <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden />
            Reserve
          </button>
        ) : null}
      </div>

      <div className="rounded-2xl bg-[#F6F4EF]/80 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#5F665F]" aria-hidden />
            <span className="text-xs font-semibold text-[#0F1614]">Who&apos;s going</span>
          </div>
          <button
            type="button"
            onClick={onInviteGroup}
            className="text-[11px] font-semibold text-[#0E6E5C] hover:underline"
          >
            Invite
          </button>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-[#5F665F]">
          Friends show up here when they vote or go live. Group Live coming soon.
        </p>
        <div className="mt-2 flex -space-x-2">
          {["A", "T", "S"].map((initial) => (
            <span
              key={initial}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#F6F4EF] bg-[#E8E4DC] text-[10px] font-bold text-[#5F665F]"
              aria-hidden
            >
              {initial}
            </span>
          ))}
          <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#F6F4EF] bg-white text-[10px] font-bold text-[#5F665F]">
            +2
          </span>
        </div>
      </div>
    </div>
  );
}
