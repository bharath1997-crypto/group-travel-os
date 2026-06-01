export function getCategoryGradient(category?: string): string {
  const map: Record<string, string> = {
    Music: "linear-gradient(160deg,#1a3a5c,#3b82f6)",
    Sports: "linear-gradient(160deg,#1a3a2c,#16a34a)",
    Experience: "linear-gradient(160deg,#3a1a5c,#8b5cf6)",
    Arts: "linear-gradient(160deg,#5c1a3a,#ec4899)",
    Comedy: "linear-gradient(160deg,#5c3a1a,#f97316)",
    Festival: "linear-gradient(160deg,#5c4a1a,#eab308)",
  };
  return map[category || ""] || "linear-gradient(160deg,#1a3a5c,#0f766e)";
}
