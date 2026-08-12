// Rovvy Brand Constants — import whenever you need brand values in code.
import { ROVVY_COLORS, ROVVY_RADIUS, ROVVY_SHADOW } from "./design-tokens";

export const BRAND = {
  name: "Rovvy",
  tagline: "Roam together",
  url: "https://rovvy.app",
  colors: {
    primary: ROVVY_COLORS.primary,
    primaryHover: ROVVY_COLORS.primaryHover,
    primarySoft: ROVVY_COLORS.primarySoft,
    navy: ROVVY_COLORS.navy,
    surface: ROVVY_COLORS.surface,
    accent: ROVVY_COLORS.primarySoft,
    appBg: ROVVY_COLORS.appBg,
    card: ROVVY_COLORS.card,
    textPrimary: ROVVY_COLORS.textOnDark,
    text: ROVVY_COLORS.text,
    textMuted: ROVVY_COLORS.muted,
    border: ROVVY_COLORS.border,
    success: ROVVY_COLORS.success,
    warning: ROVVY_COLORS.warning,
    error: ROVVY_COLORS.error,
  },
  radius: ROVVY_RADIUS,
  shadow: ROVVY_SHADOW,
  fonts: {
    display: "Outfit",
    body: "Inter",
  },
  social: {
    instagram: "@rovvyapp",
    tiktok: "@rovvyapp",
    twitter: "@rovvyapp",
  },
} as const;
