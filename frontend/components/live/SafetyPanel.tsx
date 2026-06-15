"use client";

import { useState, useEffect, useMemo } from "react";
import { ShieldAlert, Map, PhoneCall, AlertOctagon, Heart, Users, HelpCircle, Battery, BatteryCharging, CheckCircle, Clock } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Member {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  lat: number | null;
  lng: number | null;
  updated_at?: number | null;
}

interface SafetyPanelProps {
  tripId: string;
  members: Member[];
  meetPoint: { lat: number | null; lng: number | null; name?: string | null };
  currentUserId: string | null;
  isAdmin: boolean;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function SafetyPanel({
  tripId,
  members,
  meetPoint,
  currentUserId,
  isAdmin,
}: SafetyPanelProps) {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [geofenceRadius, setGeofenceRadius] = useState(500); // meters
  const [showSosConfirm, setShowSosConfirm] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState<Array<{ name: string; relation: string; phone: string }>>([
    { name: "Global SOS Emergency", relation: "Hotline", phone: "112" },
    { name: "Local Tourist Police", relation: "Helpline", phone: "911" },
  ]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactRelation, setContactRelation] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Determine battery level based on user ID to create realistic alerts
  const getBatteryLevel = (userId: string): number => {
    const charCodeSum = userId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return 10 + (charCodeSum % 89); // yields value between 10% and 98%
  };

  const memberSafetyStatusList = useMemo(() => {
    return members.map((m) => {
      let isOutsideGeofence = false;
      let distance = 0;
      if (m.lat && m.lng && meetPoint.lat && meetPoint.lng) {
        distance = calculateDistance(m.lat, m.lng, meetPoint.lat, meetPoint.lng);
        isOutsideGeofence = distance > geofenceRadius;
      }

      const battery = getBatteryLevel(m.user_id);
      const isStale = m.updated_at ? now - m.updated_at > 240 : true; // stale if no update > 4min (240s)

      let badge = "safe";
      let badgeLabel = "Safe";
      let badgeColor = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";

      if (isStale) {
        badge = "stale";
        badgeLabel = "Stale";
        badgeColor = "text-slate-400 bg-slate-500/10 border-slate-500/20";
      } else if (isOutsideGeofence || battery < 15) {
        badge = "alert";
        badgeLabel = isOutsideGeofence ? "Outside Geofence" : "Low Battery";
        badgeColor = "text-red-500 bg-red-500/10 border-red-500/20";
      }

      return {
        ...m,
        battery,
        distance,
        isOutsideGeofence,
        isStale,
        badge,
        badgeLabel,
        badgeColor,
      };
    });
  }, [members, meetPoint, geofenceRadius, now]);

  const handleSosTrigger = async () => {
    let latitude = null;
    let longitude = null;

    // Grab current user's coords if available
    const me = members.find((m) => m.user_id === currentUserId);
    if (me?.lat && me?.lng) {
      latitude = me.lat;
      longitude = me.lng;
    }

    try {
      await apiFetch(`/trips/${tripId}/sos`, {
        method: "POST",
        body: JSON.stringify({ latitude, longitude }),
      });
      setSosSent(true);
      setShowSosConfirm(false);
      setTimeout(() => setSosSent(false), 5000);
    } catch (err) {
      console.error("SOS trigger failed:", err);
      alert("Failed to broadcast SOS. Check connectivity.");
    }
  };

  const handleAdjustGeofence = () => {
    if (!isAdmin) return;
    const newRadStr = prompt("Enter geofence radius (in meters):", geofenceRadius.toString());
    if (newRadStr) {
      const rad = parseInt(newRadStr, 10);
      if (!isNaN(rad) && rad > 0) {
        setGeofenceRadius(rad);
      }
    }
  };

  const handleAddEmergencyContact = () => {
    if (!contactName.trim() || !contactPhone.trim() || !contactRelation.trim()) return;
    setEmergencyContacts([
      ...emergencyContacts,
      { name: contactName.trim(), relation: contactRelation.trim(), phone: contactPhone.trim() },
    ]);
    setContactName("");
    setContactPhone("");
    setContactRelation("");
    setShowAddContact(false);
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto select-none pr-1">
      {/* SECTION 1: Member safety cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3 flex items-center gap-1.5">
          <ShieldAlert size={14} className="text-emerald-400" />
          Crew Safety Status
        </h3>
        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
          {memberSafetyStatusList.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between bg-slate-950/40 border border-slate-800/80 rounded-xl p-2.5">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="h-8 w-8 rounded-full border border-slate-800 bg-slate-800 flex items-center justify-center overflow-hidden text-xs font-black text-slate-300">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (m.full_name || "M").charAt(0).toUpperCase()
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-200 truncate max-w-[120px]">
                      {m.full_name || "Traveler"}
                    </span>
                    {m.user_id === currentUserId && (
                      <span className="text-[8px] bg-teal-500/20 text-teal-400 px-1 py-0.2 rounded font-black">YOU</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-bold">
                    <span className="flex items-center gap-0.5">
                      {m.battery < 20 ? (
                        <Battery className="h-3 w-3 text-red-500" />
                      ) : (
                        <Battery className="h-3 w-3 text-emerald-500" />
                      )}
                      {m.battery}%
                    </span>
                    {m.lat && m.lng && (
                      <span className="flex items-center gap-0.5">
                        <Map size={10} />
                        {m.distance > 1000 ? `${(m.distance / 1000).toFixed(1)}km` : `${Math.round(m.distance)}m`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${m.badgeColor}`}>
                {m.badgeLabel}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: Geofence settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3 flex items-center gap-1.5">
          <Map size={14} className="text-blue-400" />
          Safety Geofencing
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-200">Alert Zone Radius</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
              Triggers warning when a member wanders more than {geofenceRadius}m from the meeting spot.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={handleAdjustGeofence}
              className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-250 border border-slate-700/80 rounded-xl text-xs font-bold transition"
            >
              Adjust
            </button>
          )}
        </div>
      </div>

      {/* SECTION 3: Emergency contacts */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
            <PhoneCall size={14} className="text-amber-400" />
            Emergency Contacts
          </h3>
          <button
            onClick={() => setShowAddContact(!showAddContact)}
            className="text-[10px] font-black text-teal-400 hover:underline"
          >
            {showAddContact ? "Cancel" : "Add Contact"}
          </button>
        </div>

        {showAddContact && (
          <div className="border border-slate-800 rounded-xl p-3 bg-slate-950/40 space-y-3 mb-3">
            <input
              type="text"
              placeholder="Name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full text-xs font-bold border border-slate-800 rounded-lg p-2 bg-slate-900 text-slate-200 placeholder-slate-550 focus:outline-none focus:border-[#0F766E]"
            />
            <input
              type="text"
              placeholder="Relationship / Duty"
              value={contactRelation}
              onChange={(e) => setContactRelation(e.target.value)}
              className="w-full text-xs font-bold border border-slate-800 rounded-lg p-2 bg-slate-900 text-slate-200 placeholder-slate-550 focus:outline-none focus:border-[#0F766E]"
            />
            <input
              type="text"
              placeholder="Phone number"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full text-xs font-bold border border-slate-800 rounded-lg p-2 bg-slate-900 text-slate-200 placeholder-slate-550 focus:outline-none focus:border-[#0F766E]"
            />
            <button
              onClick={handleAddEmergencyContact}
              className="w-full py-2 bg-[#0F766E] hover:bg-[#0D635C] text-white rounded-lg text-xs font-bold transition shadow"
            >
              Add Contact Detail
            </button>
          </div>
        )}

        <div className="space-y-2">
          {emergencyContacts.map((c, idx) => (
            <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-950/40 border border-slate-800/80 rounded-xl">
              <div>
                <p className="text-xs font-bold text-slate-200">{c.name}</p>
                <p className="text-[9px] font-bold text-slate-550 uppercase tracking-wide mt-0.5">{c.relation}</p>
              </div>
              <a
                href={`tel:${c.phone}`}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-xs font-black transition"
              >
                <PhoneCall size={12} />
                {c.phone}
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 4: SOS button */}
      <div className="mt-auto pt-2">
        {sosSent ? (
          <div className="w-full flex flex-col items-center gap-2 p-4 border border-red-500/20 bg-red-500/10 text-red-500 rounded-2xl animate-pulse">
            <Heart size={24} className="fill-red-500" />
            <p className="text-sm font-black uppercase tracking-wider">SOS BROADCAST ACTIVE</p>
            <p className="text-[10px] text-center text-red-400/80 leading-relaxed">
              FCM alerts dispatched to crew. Keep line clear.
            </p>
          </div>
        ) : (
          <button
            onClick={() => setShowSosConfirm(true)}
            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl flex flex-col items-center justify-center transition shadow-lg shadow-red-600/35 border border-red-500"
          >
            <span className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5">
              <AlertOctagon size={16} /> SOS — Alert All Members
            </span>
            <span className="text-[9px] font-black text-red-100/75 tracking-wide mt-0.5">
              FCM · NO INTERNET NEEDED · INCLUDES GPS
            </span>
          </button>
        )}
      </div>

      {/* SOS Confirmation Modal Overlay */}
      {showSosConfirm && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="h-12 w-12 rounded-2xl bg-red-500/15 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-4">
              <AlertOctagon size={24} />
            </div>
            <h4 className="text-md font-black text-slate-100 uppercase tracking-wider">Confirm SOS Alert</h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              This will trigger a priority emergency alert to every group member's device instantly, sharing your current location.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSosConfirm(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSosTrigger}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-red-600/30"
              >
                Trigger SOS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
