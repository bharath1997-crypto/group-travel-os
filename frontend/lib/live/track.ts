export type TrackPoint = {
  lat: number;
  lng: number;
  speed_mph: number;
  bearing: number;
  ts: string;
};

export type TripTrack = {
  id: string;
  session_id: string;
  trip_id: string | null;
  track_points: TrackPoint[];
  total_distance_m: number | null;
  total_duration_s: number | null;
  max_speed_mph: number | null;
  avg_speed_mph: number | null;
  reports_encountered: number;
  cameras_passed: number;
  started_at: string;
  ended_at: string | null;
  created_at: string;
};

export type TripTrackSummary = {
  id: string;
  session_id: string;
  total_distance_m: number | null;
  total_duration_s: number | null;
  max_speed_mph: number | null;
  avg_speed_mph: number | null;
  started_at: string;
  ended_at: string | null;
  reports_encountered: number;
  cameras_passed: number;
};

export function formatTrackDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "0 min";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

export function formatTrackDistanceMeters(meters: number | null): string {
  if (meters == null || meters <= 0) return "0.0 mi";
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

export function formatTrackDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function shareTripSummary(track: TripTrack): Promise<"shared" | "copied"> {
  const text = `I just drove ${formatTrackDistanceMeters(track.total_distance_m)} in ${formatTrackDuration(track.total_duration_s)} using Rovvy Live! Max speed: ${Math.round(track.max_speed_mph ?? 0)} mph. Try Rovvy: rovvy.app`;

  if (typeof navigator !== "undefined" && navigator.share) {
    await navigator.share({
      title: "My Rovvy Trip",
      text,
      url: "https://rovvy.app",
    });
    return "shared";
  }

  await navigator.clipboard.writeText(text);
  return "copied";
}
