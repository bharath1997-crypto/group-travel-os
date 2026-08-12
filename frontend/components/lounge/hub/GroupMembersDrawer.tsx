"use client";

import { InitialsAvatar } from "@/components/lounge/hub/InitialsAvatar";
import {
  isInlineSvgDataUrlToSkipForPhoto,
  isLegacyDicebearUrl,
} from "@/lib/lounge/hub-utils";
import type { GroupOut } from "@/lib/lounge/hub-types";

const BG = "#0F172A";
const SURFACE = "#2d4060";
const BORDER_SUB = "rgba(255,255,255,0.08)";
const TEXT_MUTED = "#8892a4";

export type GroupMembersDrawerProps = {
  open: boolean;
  group: GroupOut | null | undefined;
  onClose: () => void;
};

export function GroupMembersDrawer({
  open,
  group,
  onClose,
}: GroupMembersDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[400] flex justify-end">
      <button
        type="button"
        aria-label="Close group info"
        className="min-h-0 flex-1 bg-black/55"
        onClick={onClose}
      />
      <div
        className="flex h-full max-h-screen w-[min(100%,400px)] shrink-0 flex-col custom-scrollbar overflow-y-auto border-l shadow-2xl"
        style={{ background: BG, borderColor: BORDER_SUB }}
      >
        <div
          className="flex shrink-0 items-center justify-between border-b px-3 py-2"
          style={{ borderColor: BORDER_SUB }}
        >
          <span className="text-sm font-medium text-white">Group members</span>
          <button
            type="button"
            className="text-2xl leading-none text-slate-400 hover:text-white"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {!group ? (
          <p className="p-4 text-sm text-slate-400">Group not found</p>
        ) : (
          <>
        <p
          className="border-b px-4 py-2 text-sm font-bold text-white"
          style={{ borderColor: BORDER_SUB }}
        >
          {group.name}
        </p>
        <ul className="px-2 py-2">
          {(group.members ?? []).map((m) => (
            <li
              key={m.user_id}
              className="mb-1 flex items-center gap-3 rounded-lg px-2 py-2"
              style={{ background: SURFACE }}
            >
              {m.avatar_url?.trim() &&
              !isInlineSvgDataUrlToSkipForPhoto(m.avatar_url) &&
              !isLegacyDicebearUrl(m.avatar_url) ? (
                <img
                  src={m.avatar_url}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                  width={40}
                  height={40}
                />
              ) : (
                <InitialsAvatar name={m.full_name} size={40} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {m.full_name}
                </p>
                {m.role ? (
                  <p
                    className="text-[11px] capitalize"
                    style={{ color: TEXT_MUTED }}
                  >
                    {m.role}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
          </>
        )}
      </div>
    </div>
  );
}
