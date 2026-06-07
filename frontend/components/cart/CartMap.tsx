"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type CartItem = {
  id: string;
  item_name: string;
  place_name: string | null;
  full_address: string | null;
  lat: number;
  lng: number;
  item_type: string;
};

// Custom marker icon based on type
const pinIcon = (type: string) => {
  const colors: Record<string, string> = {
    activity: "#0F766E", // Teal
    event: "#3B82F6",    // Blue
    restaurant: "#EF4444", // Red
    hotel: "#8B5CF6",    // Purple
    other: "#6B7280"     // Gray
  };
  const color = colors[type] || colors.other;

  return L.divIcon({
    className: "cart-pin-marker",
    html: `<div style="background:${color};width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-center;color:white;font-size:10px;font-weight:bold;"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

function ChangeBounds({ items }: { items: CartItem[] }) {
  const map = useMap();

  useEffect(() => {
    const valid = items.filter((item) => item.lat && item.lng && item.lat !== 0 && item.lng !== 0);
    if (valid.length === 0) return;

    if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], 13);
    } else {
      const bounds = L.latLngBounds(valid.map((item) => [item.lat, item.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, items]);

  return null;
}

export default function CartMap({ items }: { items: CartItem[] }) {
  const validItems = items.filter((item) => item.lat && item.lng && item.lat !== 0 && item.lng !== 0);

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        className="w-full h-full z-0"
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validItems.map((item) => (
          <Marker
            key={item.id}
            position={[item.lat, item.lng]}
            icon={pinIcon(item.item_type)}
          >
            <Popup>
              <div className="p-1 max-w-xs text-xs font-sans">
                <span className="inline-block rounded px-1.5 py-0.5 mb-1 text-[9px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700">
                  {item.item_type}
                </span>
                <h3 className="font-bold text-slate-900 leading-tight">{item.item_name}</h3>
                <p className="text-slate-500 mt-0.5 text-[10px] leading-snug">
                  {item.place_name || item.full_address || "No address details available."}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
        <ChangeBounds items={validItems} />
      </MapContainer>
    </div>
  );
}
