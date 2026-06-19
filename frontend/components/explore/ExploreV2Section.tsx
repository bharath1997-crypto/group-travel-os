"use client";

import React from "react";
import Link from "next/link";

interface ExploreV2SectionProps {
  title: string;
  icon: React.ReactNode;
  seeAllHref: string;
  isEvents?: boolean;
  children: React.ReactNode;
}

export function ExploreV2Section({
  title,
  icon,
  seeAllHref,
  isEvents = false,
  children,
}: ExploreV2SectionProps) {
  return (
    <section style={{ marginBottom: "40px" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "16px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ fontSize: "20px", display: "flex", alignItems: "center" }}>{icon}</div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", margin: 0 }}>
            {title}
          </h2>
        </div>
        <Link href={seeAllHref} style={{
          fontSize: "13px",
          color: "#0F766E",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontWeight: 500,
          textDecoration: "none"
        }}>
          See all →
        </Link>
      </div>

      {/* Grid Content: horizontal scroll on mobile, grid on desktop */}
      <div 
        className="flex md:grid overflow-x-auto md:overflow-x-visible pb-4 md:pb-0 gap-4 scrollbar-none"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        }}
      >
        {children}
      </div>
    </section>
  );
}
