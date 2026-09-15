"use client";

import { X, Users, MapPin, LogOut } from "lucide-react";

type Member = {
  user_id: string;
  full_name: string;
  is_admin?: boolean;
};

type GroupInfoDrawerProps = {
  open: boolean;
  groupName: string;
  members: Member[];
  tripCount?: number;
  onClose: () => void;
  onLeave?: () => void;
};

export function GroupInfoDrawer({
  open,
  groupName,
  members,
  tripCount = 0,
  onClose,
  onLeave,
}: GroupInfoDrawerProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[150] flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-stone-200 px-3 py-2.5">
        <p className="text-xs font-bold text-slate-900">Group info</p>
        <button type="button" onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
            {groupName.charAt(0)}
          </div>
          <p className="mt-2 text-sm font-bold text-slate-900">{groupName}</p>
          <p className="text-[10px] text-stone-500">{members.length} members · {tripCount} trips</p>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
            <Users size={12} /> Members
          </p>
          <div className="space-y-1">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-2 rounded-lg bg-stone-50 px-2.5 py-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-[10px] font-bold text-primary">
                  {m.full_name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-900">{m.full_name}</p>
                  {m.is_admin ? (
                    <p className="text-[9px] font-bold text-primary">Admin</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        {tripCount > 0 ? (
          <div className="rounded-lg border border-stone-200 p-2.5">
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-stone-500">
              <MapPin size={12} /> Trips
            </p>
            <p className="mt-1 text-xs text-slate-700">{tripCount} linked trip(s)</p>
          </div>
        ) : null}
      </div>
      {onLeave ? (
        <div className="border-t border-stone-200 p-3">
          <button
            type="button"
            onClick={onLeave}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-bold text-red-700"
          >
            <LogOut size={14} /> Leave group
          </button>
        </div>
      ) : null}
    </div>
  );
}
