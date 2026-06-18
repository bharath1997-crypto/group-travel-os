"use client";

import React from "react";

export type ExplorePlace = {
  id: string;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  lat: number;
  lng: number;
  photo_url?: string | null;
  distance_m?: number | null;
  price_min?: number | null;
  is_free?: boolean;
  rating?: number | null;
  rating_count?: number | null;
  address?: any;
};

interface ExploreV2CardProps {
  place: ExplorePlace;
  showDistance?: boolean;
}

export function ExploreV2Card({ place, showDistance }: ExploreV2CardProps) {
  const distanceMiles = place.distance_m 
    ? (place.distance_m / 1609.34).toFixed(1) 
    : null;

  const [imgError, setImgError] = React.useState(false);

  return (
    <div
      className="w-[240px] md:w-auto shrink-0 md:shrink transition-all duration-200"
      style={{
        borderRadius: "12px",
        overflow: "hidden",
        background: "#FFFFFF",
        cursor: "pointer",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        border: "1px solid #F1F5F9",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.08)";
      }}
    >
      {/* Photo */}
      <div style={{ position: "relative", height: "160px", backgroundColor: "#F8FAFC" }}>
        <img
          src={(!imgError && place.photo_url) ? place.photo_url : "/placeholder.jpg"}
          alt={place.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          onError={() => {
            setImgError(true);
          }}
        />
        {/* Category badge */}
        {place.category && (
          <div style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            background: "rgba(15,118,110,0.9)",
            color: "#fff",
            padding: "3px 8px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "capitalize",
          }}>
            {place.category}
          </div>
        )}
        {/* Save button */}
        <button style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          background: "rgba(255,255,255,0.9)",
          border: "none",
          borderRadius: "50%",
          width: "32px",
          height: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontSize: "16px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}>♡</button>
      </div>

      {/* Content */}
      <div style={{ padding: "12px" }}>
        <h3 style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "#0F172A",
          marginBottom: "4px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }} title={place.name}>{place.name}</h3>
        
        {/* Subcategory */}
        {place.subcategory && (
          <p style={{
            fontSize: "12px",
            color: "#64748B",
            marginBottom: "6px",
            textTransform: "capitalize",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>{place.subcategory}</p>
        )}

        {/* Rating row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "8px",
        }}>
          <span style={{ color: "#F59E0B", fontSize: "12px" }}>
            ★ {place.rating ? place.rating.toFixed(1) : "4.5"}
          </span>
          <span style={{ fontSize: "12px", color: "#64748B" }}>
            {place.address?.city || "Nearby"}
          </span>
        </div>

        {/* Distance + CTA */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          {distanceMiles ? (
            <span style={{ fontSize: "12px", color: "#0F766E", fontWeight: 500 }}>
              📍 {distanceMiles} mi away
            </span>
          ) : (
            <span style={{ fontSize: "12px", color: "#64748B" }}>
              📍 Nearby
            </span>
          )}
          <button style={{
            background: "#0F766E",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "6px 14px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}>
            Explore →
          </button>
        </div>
      </div>
    </div>
  );
}
