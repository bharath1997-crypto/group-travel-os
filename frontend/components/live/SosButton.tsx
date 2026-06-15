"use client";

import { useState } from "react";
import { AlertOctagon, LifeBuoy, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface SosButtonProps {
  tripId: string;
}

export function SosButton({ tripId }: SosButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  const triggerSos = () => {
    if (!navigator.geolocation) {
      setStatusText("Geolocation is not supported by your browser");
      return;
    }

    setLoading(true);
    setStatusText("Retrieving location...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        setStatusText("Broadcasting emergency alert...");
        try {
          await apiFetch(`/trips/${tripId}/sos`, {
            method: "POST",
            body: JSON.stringify({ latitude, longitude }),
          });
          setStatusText("SOS Alert Sent! Help is on the way.");
          setTimeout(() => {
            setIsOpen(false);
            setStatusText(null);
            setLoading(false);
          }, 3000);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Failed to broadcast SOS alert.";
          setStatusText(errorMsg);
          setLoading(false);
        }
      },
      (error) => {
        setStatusText(`Location error: ${error.message}`);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold shadow-lg shadow-red-900/30 animate-pulse transition-all duration-200 uppercase tracking-wider text-sm"
      >
        <AlertOctagon className="h-5 w-5 animate-spin" />
        Trigger Emergency SOS
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-[#F8FAFC] border border-slate-200 max-w-sm w-full rounded-3xl shadow-2xl p-6 text-slate-800 flex flex-col items-center text-center gap-5">
            <div className="h-16 w-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center shadow-inner">
              <LifeBuoy className="h-10 w-10 animate-bounce" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-800">
                Are you in an emergency?
              </h3>
              <p className="text-sm text-slate-500 mt-2">
                This will instantly log an SOS event and broadcast your current GPS coordinates to all group members via SMS & push notifications.
              </p>
            </div>

            {statusText && (
              <div className="text-xs font-semibold px-4 py-2 bg-slate-100 rounded-xl text-slate-600 border border-slate-200 w-full flex items-center justify-center gap-2">
                {loading && <Loader2 className="h-3 w-3 animate-spin text-slate-500" />}
                <span>{statusText}</span>
              </div>
            )}

            <div className="flex gap-3 w-full mt-2">
              <button
                disabled={loading}
                onClick={() => setIsOpen(false)}
                className="flex-1 px-4 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                disabled={loading}
                onClick={triggerSos}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 shadow-md shadow-red-200 transition"
              >
                Confirm SOS
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
