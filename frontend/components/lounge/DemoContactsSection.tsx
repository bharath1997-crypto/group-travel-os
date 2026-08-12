"use client";

import {
  DEMO_CONTACTS,
  DEMO_SELF_CONTACT_ID,
  type DemoContactRow,
} from "@/lib/lounge/demo-contacts";

type SelfDemoRow = {
  kind: "self";
  id: string;
  name: string;
  initials: string;
  bg: string;
  sub: string;
};

type DemoContactsSectionProps = {
  currentUserName?: string | null;
  currentUserInitials?: string;
  currentUserBg?: string;
  onOpenDemo: (row: DemoContactRow | SelfDemoRow) => void;
  variant?: "popup" | "full";
};

export function DemoContactsSection({
  currentUserName,
  currentUserInitials = "Y",
  currentUserBg = "#0F766E",
  onOpenDemo,
  variant = "popup",
}: DemoContactsSectionProps) {
  const isFull = variant === "full";

  return (
    <div className="mb-2">
      <p
        className={`px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide ${
          isFull ? "text-slate-400" : "text-stone-500"
        }`}
      >
        Demo contacts
      </p>
      {DEMO_CONTACTS.map((d) => (
        <div
          key={d.id}
          className={`flex items-center gap-2 rounded-lg px-2 py-2 ${
            isFull ? "hover:bg-white/5" : "hover:bg-slate-50"
          }`}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: d.bg }}
          >
            {d.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-xs font-bold ${isFull ? "text-white" : "text-slate-900"}`}>
              {d.name}
              <span className="ml-1 rounded bg-stone-200 px-1 py-0.5 text-[8px] uppercase text-stone-600">
                Demo
              </span>
            </p>
            <p className={`truncate text-[10px] ${isFull ? "text-slate-400" : "text-stone-500"}`}>
              {d.sub}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenDemo(d)}
            className="shrink-0 rounded-full border border-stone-200 px-2.5 py-1 text-[10px] font-bold text-primary hover:bg-teal-50"
          >
            Message
          </button>
        </div>
      ))}
      {currentUserName ? (
        <div
          className={`flex items-center gap-2 rounded-lg px-2 py-2 ${
            isFull ? "hover:bg-white/5" : "hover:bg-slate-50"
          }`}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: currentUserBg }}
          >
            {currentUserInitials}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-xs font-bold ${isFull ? "text-white" : "text-slate-900"}`}>
              {currentUserName}
              <span className="ml-1 rounded bg-stone-200 px-1 py-0.5 text-[8px] uppercase text-stone-600">
                Demo
              </span>
            </p>
            <p className={`truncate text-[10px] ${isFull ? "text-slate-400" : "text-stone-500"}`}>
              Your account · demo self-chat
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onOpenDemo({
                kind: "self",
                id: DEMO_SELF_CONTACT_ID,
                name: currentUserName,
                initials: currentUserInitials,
                bg: currentUserBg,
                sub: "Your account · demo self-chat",
              })
            }
            className="shrink-0 rounded-full border border-stone-200 px-2.5 py-1 text-[10px] font-bold text-primary hover:bg-teal-50"
          >
            Message
          </button>
        </div>
      ) : null}
    </div>
  );
}
