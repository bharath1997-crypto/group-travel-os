export type LiveAiSuggestionKind = "tip" | "warning";

export type LiveAiSuggestionItem = {
  id: string;
  message: string;
  kind: LiveAiSuggestionKind;
  /** Seed text when user taps Ask Wayra on this suggestion. */
  askPrompt?: string;
};

export function buildCombinedWayraPrompt(
  destinationName: string,
  suggestions: LiveAiSuggestionItem[],
): string {
  const dest = destinationName.trim() || "this place";
  if (suggestions.length === 0) {
    return `I'm planning a trip to ${dest} on Rovvy Live. What should I know about this place, and what are some interesting things to see or do nearby?`;
  }
  const lines = suggestions.map((item) => `- ${item.message}`).join("\n");
  return `I'm planning a trip to ${dest} on Rovvy Live. Here are the tips and warnings I see:\n${lines}\n\nWhat should I know and how should I prepare?`;
}

export function buildRoutePreviewAiSuggestions(options: {
  destinationName: string;
  farFromUser?: boolean;
  lastMileNotice?: string | null;
  borderNotice?: string | null;
  lowGps?: boolean;
  routeError?: string | null;
  contextNotice?: string | null;
  terrainHint?: string | null;
}): LiveAiSuggestionItem[] {
  const dest = options.destinationName.trim() || "this place";
  const items: LiveAiSuggestionItem[] = [];

  if (options.contextNotice?.trim()) {
    items.push({
      id: "context",
      kind: "tip",
      message: options.contextNotice.trim(),
      askPrompt: `I'm looking at ${dest} on the Live map. ${options.contextNotice.trim()} What should I know before I go?`,
    });
  }

  if (options.farFromUser) {
    items.push({
      id: "far",
      kind: "tip",
      message: "Far from your current area.",
      askPrompt: `I want to drive to ${dest}, but it's far from where I am now. What should I plan for — stops, timing, and whether this trip makes sense?`,
    });
  }

  if (options.lastMileNotice?.trim()) {
    items.push({
      id: "last-mile",
      kind: "warning",
      message: options.lastMileNotice.trim(),
      askPrompt: `For ${dest}: ${options.lastMileNotice.trim()} Can you suggest the best way to finish the trip on foot or by trail?`,
    });
  }

  if (options.borderNotice?.trim()) {
    items.push({
      id: "border",
      kind: "warning",
      message: options.borderNotice.trim(),
      askPrompt: `I'm routing to ${dest} and saw this border notice: "${options.borderNotice.trim()}" What documents or checkpoints should I prepare for?`,
    });
  }

  if (options.lowGps) {
    items.push({
      id: "gps",
      kind: "warning",
      message: "Low GPS accuracy — go outdoors for a better fix.",
      askPrompt: `My GPS accuracy is poor while planning a trip to ${dest}. How can I get a reliable location fix for navigation?`,
    });
  }

  if (options.terrainHint?.trim()) {
    items.push({
      id: "terrain",
      kind: "tip",
      message: options.terrainHint.trim(),
      askPrompt: `I'm heading to ${dest}. Terrain note: ${options.terrainHint.trim()} What gear or access tips do you recommend?`,
    });
  }

  if (options.routeError?.trim()) {
    items.push({
      id: "route-error",
      kind: "warning",
      message: options.routeError.trim(),
      askPrompt: `I couldn't get a drive route to ${dest}. Error: "${options.routeError.trim()}" What alternatives should I try?`,
    });
  }

  return items;
}
