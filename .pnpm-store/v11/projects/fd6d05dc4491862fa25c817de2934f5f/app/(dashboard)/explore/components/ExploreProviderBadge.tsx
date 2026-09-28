"use client";

import styles from "../explore.module.css";

type ExploreProviderBadgeProps = {
  label: string;
  variant?: "dark" | "urgency" | "accent" | "light" | "neutral";
  align?: "left" | "right";
};

export function ExploreProviderBadge({ label, variant = "dark", align = "left" }: ExploreProviderBadgeProps) {
  const variantClass = styles[`providerBadge${variant.charAt(0).toUpperCase()}${variant.slice(1)}`];
  const alignClass = align === "right" ? styles.providerBadgeRight : styles.providerBadgeLeft;
  return <span className={`${styles.providerBadge} ${variantClass} ${alignClass}`}>{label}</span>;
}
