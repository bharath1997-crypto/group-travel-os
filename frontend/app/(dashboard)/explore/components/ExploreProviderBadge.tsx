"use client";

import styles from "../explore.module.css";

type ExploreProviderBadgeProps = {
  label: string;
  variant?: "dark" | "urgency" | "accent" | "light" | "neutral";
  align?: "left" | "right";
  layout?: "overlay" | "inline";
};

export function ExploreProviderBadge({
  label,
  variant = "dark",
  align = "left",
  layout = "overlay",
}: ExploreProviderBadgeProps) {
  const variantClass = styles[`providerBadge${variant.charAt(0).toUpperCase()}${variant.slice(1)}`];
  const alignClass = align === "right" ? styles.providerBadgeRight : styles.providerBadgeLeft;
  const layoutClass = layout === "inline" ? styles.providerBadgeInline : styles.providerBadge;
  return <span className={`${layoutClass} ${variantClass} ${layoutClass === styles.providerBadge ? alignClass : ""}`}>{label}</span>;
}
