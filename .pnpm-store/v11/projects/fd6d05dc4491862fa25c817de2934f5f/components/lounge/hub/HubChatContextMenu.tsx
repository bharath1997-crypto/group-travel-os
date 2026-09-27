"use client";

import type { ChatInfo } from "@/lib/lounge/hub-types";
import type { ChatPrefs } from "@/lib/lounge/chat-prefs";

export type HubChatContextMenuState = {
  x: number;
  y: number;
  chat: ChatInfo;
} | null;

type MenuItem = {
  label: string;
  onClick: () => void | Promise<void>;
};

type HubChatContextMenuProps = {
  menu: HubChatContextMenuState;
  onClose: () => void;
  tone: "hub" | "dock";
  chatPrefs: Record<string, ChatPrefs>;
  updateChatPref: (
    chatId: string,
    partial: Partial<ChatPrefs>,
  ) => void | Record<string, ChatPrefs>;
  onDeleteChat?: (chatId: string) => void;
  onClearChat?: (chat: ChatInfo) => void | Promise<void>;
  onExitGroup?: (chat: ChatInfo) => void | Promise<void>;
  onReport?: () => void;
  showToast?: (msg: string, type?: "success" | "error") => void;
};

function clampPosition(x: number, y: number, maxX: number, maxY: number) {
  return {
    left: Math.min(
      x,
      typeof window !== "undefined" ? window.innerWidth - maxX : x,
    ),
    top: Math.min(
      y,
      typeof window !== "undefined" ? window.innerHeight - maxY : y,
    ),
  };
}

export function HubChatContextMenu({
  menu,
  onClose,
  tone,
  chatPrefs,
  updateChatPref,
  onDeleteChat,
  onClearChat,
  onExitGroup,
  onReport,
  showToast,
}: HubChatContextMenuProps) {
  if (!menu) return null;

  const commonItems: MenuItem[] = [
    {
      label: "Mark as read",
      onClick: () => {
        updateChatPref(menu.chat.id, { lastReadAt: Date.now() });
      },
    },
    {
      label: "Mute",
      onClick: () => {
        updateChatPref(menu.chat.id, {
          muted: !chatPrefs[menu.chat.id]?.muted,
        });
      },
    },
    {
      label: "Archive",
      onClick: () => {
        updateChatPref(menu.chat.id, { archived: true });
      },
    },
    {
      label: "Pin to top",
      onClick: () => {
        updateChatPref(menu.chat.id, {
          pinned: !chatPrefs[menu.chat.id]?.pinned,
        });
      },
    },
  ];

  const items: MenuItem[] =
    tone === "dock"
      ? [
          ...commonItems,
          {
            label: "Delete",
            onClick: () => {
              onDeleteChat?.(menu.chat.id);
              showToast?.("Chat removed from this device");
            },
          },
        ]
      : [
          ...commonItems,
          ...(onClearChat
            ? [
                {
                  label: "Clear chat",
                  onClick: () => onClearChat(menu.chat),
                },
              ]
            : []),
          ...(menu.chat.type === "group" && onExitGroup
            ? [
                {
                  label: "Exit group",
                  onClick: () => onExitGroup(menu.chat),
                },
              ]
            : []),
          ...(onReport
            ? [
                {
                  label: "Report",
                  onClick: onReport,
                },
              ]
            : []),
        ];

  const isHub = tone === "hub";
  const pos = clampPosition(menu.x, menu.y, isHub ? 230 : 200, isHub ? 320 : 280);

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: isHub ? 380 : 310 }}
      role="presentation"
      onClick={onClose}
    >
      <div
        role="menu"
        className={
          isHub
            ? "absolute max-h-[min(80vh,420px)] w-56 custom-scrollbar overflow-y-auto rounded-xl border py-2 shadow-2xl"
            : "absolute w-48 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-2xl"
        }
        style={
          isHub
            ? {
                background: "#2d4060",
                borderColor: "rgba(255,255,255,0.08)",
                left: pos.left,
                top: pos.top,
              }
            : { left: pos.left, top: pos.top }
        }
        onClick={(e) => e.stopPropagation()}
      >
        {items.map(({ label, onClick }) => (
          <button
            key={label}
            type="button"
            role="menuitem"
            className={
              isHub
                ? "block w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10"
                : "block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-stone-50"
            }
            onClick={() => {
              void onClick();
              onClose();
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
