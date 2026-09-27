export const DEMO_CHAT_ROVVY_HELP_ID = "__demo_travello_help__";
export const DEMO_CHAT_COMMUNITY_ID = "__demo_community_updates__";

export const GT_CALL_HISTORY = "gt_call_history";
export const GT_STARRED_MESSAGES = "gt_starred_messages";
export const GT_RECENT_EMOJIS = "gt_recent_emojis";

export const QUICK_REACTION_CHIPS = [
  "OK",
  "Hi",
  "Thanks",
  "On my way",
  "Sounds good",
  "Will do",
  "Done",
  "Yes",
  "No",
  "Maybe",
  "See you",
  "On it",
  "Let me know",
  "Call me",
  "Later",
  "Here",
  "Arrived",
  "Busy",
  "Free",
  "Hello",
] as const;

export const BOT_CHIP_QUESTIONS = [
  "How do I create a trip?",
  "How does expense split work?",
  "What is live coordination?",
  "How to invite friends?",
  "What's included in Pro plan?",
] as const;

export const BOT_ANSWERS: Record<(typeof BOT_CHIP_QUESTIONS)[number], string> = {
  "How do I create a trip?":
    "Go to Trips, click Plan New Trip, choose Social or Business, then fill in details or upload a document and our AI will fill it for you.",
  "How does expense split work?":
    "Tap the split button in any group chat, enter the amount, choose who paid, and select who to split with. Everyone sees their share instantly.",
  "What is live coordination?":
    "When your trip starts, activate Live mode. Everyone's location appears on a shared map. Drop meetup pins, set countdown timers, and see who has arrived. Needs a 3-Day Pass or Pro.",
  "How to invite friends?":
    "Open your group, share the invite code, or copy the invite link. Friends can join by entering the code. No app download is needed on the web.",
  "What's included in Pro plan?":
    "Pro (₹849/month) includes: unlimited trips, live coordination, receipt scanner, expense export PDF, AI trip planner, and everything in Free. Upgrade in your Profile.",
};

export const BOT_FALLBACK =
  "I don't have an answer for that yet, but our team is working on it! Try one of the suggested questions above.";

export const TENOR_API_KEY = "AIzaSyAyimkuYQYF_FXVALexPzkcsvZpe6MePdw";

export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: "turn:standard.relay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:standard.relay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

export type GtCallHistoryEntry = {
  user_id: string;
  user_name: string;
  call_type: "audio" | "video";
  direction: "outgoing" | "incoming" | "missed";
  duration: number;
  timestamp: number;
  status: string;
};

export type StarredMessage = {
  chatId: string;
  messageId: string;
  text: string;
  senderName: string;
  timestamp: number;
};
