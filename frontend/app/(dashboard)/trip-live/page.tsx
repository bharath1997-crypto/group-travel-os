"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Loader2, AlertCircle } from "lucide-react";

interface ActiveSessionResponse {
  active: boolean;
  trip_id?: string;
}

interface UpcomingTrip {
  trip_id: string;
  title: string;
}

export default function TripLiveIndexRedirect() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function resolveLiveTrip() {
      try {
        // 1. Check if there is a running active session
        const activeRes = await apiFetch<ActiveSessionResponse>("/live/my-active-session");
        if (activeRes && activeRes.active && activeRes.trip_id) {
          router.replace(`/trip-live/${activeRes.trip_id}`);
          return;
        }

        // 2. Fallback: Check for upcoming or recent trips to direct the user to
        const upcomingRes = await apiFetch<UpcomingTrip[]>("/live/upcoming-trips");
        if (Array.isArray(upcomingRes) && upcomingRes.length > 0) {
          router.replace(`/trip-live/${upcomingRes[0].trip_id}`);
          return;
        }

        // 3. Absolute Fallback: Find any trip from /trips (if no upcoming live trips)
        const allTrips = await apiFetch<any[]>("/trips");
        if (Array.isArray(allTrips) && allTrips.length > 0) {
          router.replace(`/trip-live/${allTrips[0].id}`);
          return;
        }

        // No trips at all
        router.replace("/trips");
      } catch (err: any) {
        console.error("Redirect resolution failed:", err);
        setError("Failed to locate your active trip session. Please make sure you are logged in.");
      }
    }

    resolveLiveTrip();
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 text-slate-800">
        <div className="max-w-md w-full bg-white border border-slate-200 shadow-xl rounded-3xl p-8 text-center flex flex-col items-center gap-4">
          <AlertCircle className="h-12 w-12 text-red-600 animate-bounce" />
          <h2 className="text-xl font-bold text-slate-850">Resolution Error</h2>
          <p className="text-sm text-slate-500">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2.5 bg-[#0F766E] text-white rounded-xl font-semibold shadow hover:bg-[#0D635C] transition"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-slate-800">
      <Loader2 className="h-10 w-10 animate-spin text-[#0F766E]" />
      <p className="mt-4 text-sm font-semibold text-slate-500 animate-pulse">
        Connecting to your live trip space...
      </p>
    </div>
  );
}
