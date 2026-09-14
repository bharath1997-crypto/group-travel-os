export type TripMemberLocationStatus = "active" | "idle" | "stale";

export type TripMemberLocation = {
  userId: string;
  lat: number;
  lng: number;
  updatedAt: number;
  speedMps?: number | null;
  heading?: number | null;
  status: TripMemberLocationStatus;
  name?: string | null;
  travelMode?: string | null;
};

export type GroupMemberSummary = {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
};

export type LiveGroupLocationPayload = {
  lat: number;
  lng: number;
  speedMps: number | null;
  heading: number | null;
  updatedAt: number;
  status: TripMemberLocationStatus;
  name: string;
  travelMode: string;
};
