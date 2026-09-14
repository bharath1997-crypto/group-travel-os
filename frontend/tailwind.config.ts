import type { Config } from "tailwindcss";

export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-schibsted)", "sans-serif"],
        display: ["var(--font-instrument)", "Georgia", "serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      colors: {
        primary: "var(--color-primary)",
        "primary-hover": "var(--color-primary-hover)",
        "primary-soft": "var(--color-primary-soft)",
        "primary-light": "var(--color-primary-light)",
        "primary-dark": "var(--color-primary-dark)",
        "primary-highlight": "var(--color-primary-highlight)",
        cream: "var(--color-cream)",
        navy: "var(--color-navy)",
        surface: "var(--color-surface)",
        app: "var(--color-app)",
        card: "var(--color-card)",
        elevated: "var(--color-elevated)",
        text: "var(--color-text)",
        "text-on-dark": "var(--color-text-on-dark)",
        muted: "var(--color-muted)",
        border: "var(--color-border)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        error: "var(--color-error)",
        info: "var(--color-info)",
        sidebar: "var(--color-sidebar)",
      },
      borderRadius: {
        control: "var(--radius-control)",
        card: "var(--radius-card)",
        modal: "var(--radius-modal)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        panel: "var(--shadow-panel)",
        float: "var(--shadow-float)",
      },
    },
  },
} satisfies Config;
