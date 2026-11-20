import type { OfferTourStep } from "./seats-offer-tour";

export const FIND_TOUR_KEY = "rovvy.seatshare.find-tour.v1";

/** The first-time walkthrough for Find a seat. Static text only: no sample prices or fake rides. */
export const FIND_TOUR_STEPS: OfferTourStep[] = [
  {
    id: "welcome",
    title: "Find a seat on a road trip going your way",
    body: "SeatShare connects you with drivers who already make the trip and have empty seats.",
    points: [
      "Four-wheelers only, road trips up to 200 miles.",
      "You pay the driver a share of fuel and tolls directly. Rovvy takes nothing and moves no money.",
      "Searching is free. You log in only when you book, ask to join or watch a route.",
    ],
  },
  {
    id: "search",
    title: "Step 1: Say where, when and how many",
    body: "Set your trip, then search.",
    points: [
      "Fill in From and To: type an address, use your location, or drop a pin on the map.",
      "Pick when you are leaving and how many seats you need.",
      "Search turns on once both ends are confirmed, and the road preview shows the route you will ride.",
    ],
  },
  {
    id: "results",
    title: "Step 2: Compare the rides",
    body: "Sort the list by Earliest or Cheapest to find the one that suits you.",
    points: [
      "Each card shows the departure and arrival time, your pickup and drop-off, the driver and their car, and seats left.",
      "The price is per seat and covers fuel and tolls only; drivers cannot ask for more than the cost share.",
      "Drivers may add a pickup note, luggage space and ride rules. Only what the driver stated is shown.",
    ],
  },
  {
    id: "book",
    title: "Step 3: Book it or ask to join",
    body: "How you join depends on the driver's setting.",
    points: [
      "Book it: your seat is confirmed at once.",
      "Ask to join: the driver approves first, and you will see the answer in Your rides.",
      "You can have up to 5 pending requests at a time.",
    ],
  },
  {
    id: "watch",
    title: "Nothing yet? Watch the route",
    body: "If no ride fits, you do not have to keep checking.",
    points: [
      "Tap Watch this route and Rovvy notifies you when a matching trip is posted.",
      "Manage your route alerts from the bell next to your profile.",
    ],
  },
  {
    id: "after",
    title: "After you book: Your rides",
    body: "Everything about your trips lives in the Your rides tab.",
    points: [
      "See the status of each seat or request, and cancel a seat or request there.",
      "Message the driver to agree the exact pickup, and settle payment directly with them.",
      "If a driver cancels, you are told in the app.",
    ],
  },
];

export function hasSeenFindTour(): boolean {
  try {
    return window.localStorage.getItem(FIND_TOUR_KEY) === "seen";
  } catch {
    // Storage blocked: do not show the demo on every visit.
    return true;
  }
}

export function markFindTourSeen(): void {
  try {
    window.localStorage.setItem(FIND_TOUR_KEY, "seen");
  } catch {
    /* ignore */
  }
}
