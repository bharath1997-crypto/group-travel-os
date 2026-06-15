/** Travel-themed sticker pack for lounge chat */
export const TRAVEL_STICKER_PACK = [
  { id: "plane", emoji: "✈️", label: "Flying" },
  { id: "beach", emoji: "🏖️", label: "Beach" },
  { id: "mountain", emoji: "🏔️", label: "Mountain" },
  { id: "map", emoji: "🗺️", label: "Map" },
  { id: "camera", emoji: "📸", label: "Photo" },
  { id: "passport", emoji: "🛂", label: "Passport" },
  { id: "hotel", emoji: "🏨", label: "Hotel" },
  { id: "train", emoji: "🚆", label: "Train" },
  { id: "car", emoji: "🚗", label: "Road trip" },
  { id: "camp", emoji: "⛺", label: "Camping" },
  { id: "sunset", emoji: "🌅", label: "Sunset" },
  { id: "party", emoji: "🎉", label: "Celebrate" },
  { id: "coffee", emoji: "☕", label: "Coffee" },
  { id: "food", emoji: "🍜", label: "Food" },
  { id: "money", emoji: "💰", label: "Budget" },
  { id: "heart", emoji: "❤️", label: "Love" },
] as const;

export const GT_LOUNGE_STATUS = "gt_lounge_status_v1";

export type LoungeStatus = {
  userId: string;
  userName: string;
  text: string;
  updatedAt: number;
};
