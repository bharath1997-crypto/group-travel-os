"use client";

export type HubTabId = "chats" | "calls" | "groups" | "updates";

export type HubTabBarProps = {
  activeTab: HubTabId;
  onTabChange: (tab: HubTabId) => void;
  /** @default "hub" */
  variant?: "hub" | "dock";
  /** Tabs to show; defaults to all four */
  tabs?: HubTabId[];
};

const TAB_LABELS: Record<HubTabId, string> = {
  chats: "Chats",
  calls: "Calls",
  groups: "Groups",
  updates: "Updates",
};

const HUB_BG = "#0f3460";
const HUB_BORDER = "rgba(255,255,255,0.08)";
const HUB_BRAND = "#E94560";

export function HubTabBar({
  activeTab,
  onTabChange,
  variant = "hub",
  tabs = ["chats", "calls", "updates"],
}: HubTabBarProps) {
  if (variant === "dock") {
    return (
      <div className="shrink-0 border-b border-slate-800/80 bg-slate-950 px-2 pb-1.5">
        <div className="flex rounded-lg bg-slate-900 p-0.5 text-xs font-semibold">
          {tabs.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`flex-1 rounded-md py-1 transition-all ${
                activeTab === id
                  ? "bg-[#0F766E] text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {TAB_LABELS[id]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex w-full shrink-0"
      style={{
        height: 44,
        background: HUB_BG,
        borderBottom: `0.5px solid ${HUB_BORDER}`,
      }}
    >
      {tabs.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onTabChange(id)}
          className="flex-1 border-0 text-center text-[14px] outline-none"
          style={{
            lineHeight: "44px",
            padding: 0,
            color:
              activeTab === id ? "#ffffff" : "rgba(255,255,255,0.68)",
            fontWeight: 500,
            borderBottom:
              activeTab === id
                ? `2px solid ${HUB_BRAND}`
                : "2px solid transparent",
            background: "transparent",
          }}
        >
          {TAB_LABELS[id]}
        </button>
      ))}
    </div>
  );
}
