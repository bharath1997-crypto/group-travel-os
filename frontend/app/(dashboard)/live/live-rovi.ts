import { apiFetch } from "@/lib/api";
import type { RoviCompactContext } from "./live-location-context";

export type RoviRiskLevel = "normal" | "far" | "very_far";

export type RoviPlaceExplanation = {
  summary: string;
  recommendation: string;
  actions: string[];
  risk_level: RoviRiskLevel;
};

export type RoviPlaceExplanationRequest = {
  compact_context: RoviCompactContext;
};

export async function fetchRoviPlaceExplanation(
  compactContext: RoviCompactContext,
): Promise<RoviPlaceExplanation> {
  return apiFetch<RoviPlaceExplanation>("/live/ai/place-explanation", {
    method: "POST",
    body: JSON.stringify({ compact_context: compactContext }),
  });
}
