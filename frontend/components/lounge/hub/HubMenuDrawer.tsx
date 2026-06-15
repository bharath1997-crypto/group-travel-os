"use client";

const BG = "#0f3460";
const BORDER_SUB = "rgba(255,255,255,0.08)";
const TEXT_MUTED = "#8892a4";

export type HubMenuDrawerProps = {
  open: boolean;
  userName?: string | null;
  onClose: () => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  onContacts: () => void;
  onLinkedDevices: () => void;
  onStarred: () => void;
  onSettings: () => void;
};

export function HubMenuDrawer({
  open,
  userName,
  onClose,
  onNewChat,
  onNewGroup,
  onContacts,
  onLinkedDevices,
  onStarred,
  onSettings,
}: HubMenuDrawerProps) {
  if (!open) return null;

  const run = (fn: () => void) => {
    onClose();
    fn();
  };

  return (
    <div className="fixed inset-0 z-[360]">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
      />
      <div
        className="absolute right-0 top-0 flex h-full w-[min(100%,300px)] flex-col border-l shadow-2xl"
        style={{
          background: BG,
          borderColor: BORDER_SUB,
        }}
      >
        <div
          className="border-b px-4 py-4"
          style={{ borderColor: BORDER_SUB }}
        >
          <p className="text-sm font-medium text-white">Connect</p>
          <p className="text-xs" style={{ color: TEXT_MUTED }}>
            {userName?.trim() || "Travel Hub"}
          </p>
        </div>
        <nav className="flex flex-1 flex-col p-2 text-left text-sm text-white">
          <button
            type="button"
            className="rounded-lg px-3 py-3 text-left hover:bg-white/5"
            onClick={() => run(onNewChat)}
          >
            New chat
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-3 text-left hover:bg-white/5"
            onClick={() => run(onNewGroup)}
          >
            New group
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-3 text-left hover:bg-white/5"
            onClick={() => run(onContacts)}
          >
            Contacts
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-3 text-left hover:bg-white/5"
            onClick={() => run(onLinkedDevices)}
          >
            Linked devices
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-3 text-left hover:bg-white/5"
            onClick={() => run(onStarred)}
          >
            Starred
          </button>
          <div
            className="my-2 h-px w-full"
            style={{ background: BORDER_SUB }}
          />
          <button
            type="button"
            className="rounded-lg px-3 py-3 text-left font-semibold hover:bg-white/5"
            onClick={() => run(onSettings)}
          >
            Settings
          </button>
        </nav>
      </div>
    </div>
  );
}
