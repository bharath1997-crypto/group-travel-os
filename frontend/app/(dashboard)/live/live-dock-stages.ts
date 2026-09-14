export type LiveDockStage =
  | "setup"
  | "nearby"
  | "place"
  | "vote"
  | "converge"
  | "navigate"
  | "seat"
  | "inbox"
  | "settle";

export const LIVE_DOCK_PANEL_WIDTH: Record<LiveDockStage, string> = {
  setup: "332px",
  nearby: "324px",
  place: "348px",
  vote: "336px",
  converge: "320px",
  navigate: "324px",
  seat: "356px",
  inbox: "340px",
  settle: "324px",
};

export const LIVE_DOCK_STAGE_LABELS: Record<LiveDockStage, string> = {
  setup: "Trip setup",
  nearby: "Nearby results",
  place: "Place detail",
  vote: "Group vote",
  converge: "Converging",
  navigate: "Navigation",
  seat: "Seat Share",
  inbox: "Notifications",
  settle: "Settle up",
};

/** Stages wired in production today — others show a coming-soon toast. */
export const LIVE_DOCK_STAGE_ENABLED: Record<LiveDockStage, boolean> = {
  setup: true,
  nearby: true,
  place: true,
  vote: true,
  converge: true,
  navigate: false,
  seat: true,
  inbox: false,
  settle: true,
};
