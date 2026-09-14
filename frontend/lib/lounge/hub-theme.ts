import { ROVVY_COLORS } from "@/lib/design-tokens";

/** List / left-panel colors for full-page travel hub tabs */
export const HUB_LIST_THEME = {
  ACCENT: ROVVY_COLORS.primary,
  BG: ROVVY_COLORS.navy,
  LIST_ROW_HOVER: ROVVY_COLORS.primarySoft,
  LIST_ROW_SELECTED: ROVVY_COLORS.primary,
  TEXT: ROVVY_COLORS.textOnDark,
  TEXT_MUTED: "#94A3B8",
  TEXT_SECONDARY: "#94A3B8",
  SECTION_LABEL: "#94A3B8",
  BRAND_ACCENT: ROVVY_COLORS.primary,
  LIST_TEXT: ROVVY_COLORS.text,
  LIST_TEXT_MUTED: "#64748B",
  LIST_BORDER: "#E2E8F0",
  ONLINE: ROVVY_COLORS.success,
  RIGHT_PANEL_BG: ROVVY_COLORS.appBg,
  BORDER_SUB: "rgba(255,255,255,0.08)",
  MSG_BORDER: "#E2E8F0",
  SURFACE: ROVVY_COLORS.surface,
  EMAIL_INVITE_AVATAR_BG: ROVVY_COLORS.primary,
  ADD_BY_EMAIL_ROW_BG: ROVVY_COLORS.surface,
} as const;
