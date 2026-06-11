export type DemoContactKind = "arjun" | "priya" | "suresh" | "self";

export type DemoContactRow = {
  id: string;
  name: string;
  initials: string;
  bg: string;
  sub: string;
  kind: DemoContactKind;
};

export type DemoScriptLine = { dir: "in" | "out"; text: string; time: string };

export const DEMO_CONTACTS: DemoContactRow[] = [
  {
    id: "__demo_contact_arjun__",
    name: "Arjun Mehta",
    initials: "AM",
    bg: "#2563EB",
    sub: "2 groups in common · Last seen today",
    kind: "arjun",
  },
  {
    id: "__demo_contact_priya__",
    name: "Priya Sharma",
    initials: "PS",
    bg: "#7C3AED",
    sub: "1 group in common · Last seen yesterday",
    kind: "priya",
  },
  {
    id: "__demo_contact_suresh__",
    name: "Suresh Kumar",
    initials: "SK",
    bg: "#059669",
    sub: "3 groups in common · Last seen Apr 20",
    kind: "suresh",
  },
];

export const DEMO_DM_SCRIPTS: Record<DemoContactKind, DemoScriptLine[]> = {
  arjun: [
    { dir: "in", text: "Hey! Are we still going to Goa next month?", time: "Apr 20, 10:30 AM" },
    { dir: "out", text: "Yes! Booking flights this week. Check the poll I created.", time: "Apr 20, 10:32 AM" },
    { dir: "in", text: "Perfect. Should I book the hotel or will the group decide?", time: "Apr 20, 10:33 AM" },
    { dir: "out", text: "Let's do a poll for that too.", time: "Apr 20, 10:35 AM" },
    { dir: "in", text: "Good idea. Also Suresh is asking about the budget split.", time: "Apr 20, 11:00 AM" },
    { dir: "out", text: "Tell him to check the Split Activities section — it's all tracked there!", time: "Apr 20, 11:02 AM" },
    { dir: "in", text: "This app is actually really useful.", time: "Apr 20, 11:05 AM" },
  ],
  priya: [
    { dir: "in", text: "Did you add me to the Manali trip?", time: "Apr 21, 9:00 AM" },
    { dir: "out", text: "Yes! Check your groups — you should see Manali Winter there.", time: "Apr 21, 9:02 AM" },
    { dir: "in", text: "Got it! The live location feature is great.", time: "Apr 21, 9:10 AM" },
    { dir: "out", text: "Right? It works best when everyone enables it at the same time.", time: "Apr 21, 9:11 AM" },
    { dir: "in", text: "How do I check who owes me money?", time: "Apr 21, 9:15 AM" },
    { dir: "out", text: "Go to the trip, then the Expenses tab, then Balance Summary. It shows everything.", time: "Apr 21, 9:16 AM" },
    { dir: "in", text: "Found it! Arjun owes me ₹800.", time: "Apr 21, 9:18 AM" },
  ],
  suresh: [
    { dir: "in", text: "Bhai when is the Kashmir trip confirmed?", time: "Apr 19, 6:00 PM" },
    { dir: "out", text: "Still planning. Join the group and vote on the poll!", time: "Apr 19, 6:05 PM" },
    { dir: "in", text: "Done! I voted for June dates. Budget looks a bit high though.", time: "Apr 19, 6:10 PM" },
    { dir: "out", text: "We can split differently — I'll adjust the expense split.", time: "Apr 19, 6:12 PM" },
    { dir: "in", text: "The map with all our saved pins is amazing.", time: "Apr 19, 6:20 PM" },
    { dir: "out", text: "Haha yes! I saved like 15 spots already from Instagram reels.", time: "Apr 19, 6:21 PM" },
    { dir: "in", text: "See you in Kashmir then!", time: "Apr 19, 6:25 PM" },
  ],
  self: [
    {
      dir: "in",
      text: "This is your own account — use it to test group features!",
      time: "System",
    },
  ],
};

export const DEMO_AUTO_REPLIES = [
  "Got it!",
  "Sounds good!",
  "Let me check and get back to you.",
  "Ha! True.",
  "Yes, definitely!",
  "I'll ask the group.",
] as const;

export const DEMO_SELF_CONTACT_ID = "__demo_contact_self__";

export function isDemoChatId(id: string): boolean {
  return (
    id.startsWith("__demo_contact_") ||
    id === DEMO_SELF_CONTACT_ID
  );
}
