export const OFFER_TOUR_KEY = "rovvy.seatshare.offer-tour.v1";

export type OfferTourStep = {
  id: string;
  title: string;
  body: string;
  /** Short bullet points shown under the body. */
  points: string[];
};

/** The first-time walkthrough for Offer a ride. Static text only: no sample prices or fake rides. */
export const OFFER_TOUR_STEPS: OfferTourStep[] = [
  {
    id: "welcome",
    title: "Offer empty seats on a drive you already make",
    body: "SeatShare lets you share the cost of a road trip with riders going your way.",
    points: [
      "Four-wheelers only, road trips up to 200 miles.",
      "Riders pay a share of fuel and tolls. Rovvy takes nothing and moves no money; you settle directly.",
      "It takes four short steps, and your draft is saved on this device if you leave.",
    ],
  },
  {
    id: "route",
    title: "Step 1: Your driving route",
    body: "Say where you start and where you finish, then pick the exact road you will drive.",
    points: [
      "Type an address, use your location, or drop a pin on the map.",
      "Choose a road path: primary, fastest or avoid tolls. Only routes within 200 miles can continue.",
      "Pick your vehicle type: sedan, SUV, compact or minivan.",
    ],
  },
  {
    id: "when",
    title: "Step 2: When and how riders book",
    body: "Set the departure and decide how riders join.",
    points: [
      "Times use your pickup's time zone, and the date can't be in the past.",
      "Choose how many seats you offer, and whether a booking confirms at once or you approve each rider.",
      "Optional: a flexible window, a weekly repeat on chosen days, and a return ride.",
    ],
  },
  {
    id: "price",
    title: "Step 3: Price and ride details",
    body: "You set the price per seat, but you can only ask for less than the cost share, never more.",
    points: [
      "Rovvy shows the fuel and toll cost split between you and your riders as the maximum per seat.",
      "Type a normal amount such as 12.50, or tap Use the max.",
      "Add a pickup note, luggage space, ride rules and your car's make, model and colour. All optional, and only what you fill in is shown.",
    ],
  },
  {
    id: "review",
    title: "Step 4: Review and publish",
    body: "Check everything the way riders will see it, then publish.",
    points: [
      "A repeat or return trip publishes several rides at once; the button shows how many.",
      "If one fails, the rides already published are kept and Publish finishes the rest.",
    ],
  },
  {
    id: "after",
    title: "After you publish: Your rides",
    body: "Manage everything from the Your rides tab.",
    points: [
      "Approve or decline rider requests, and message riders you want to check first.",
      "Edit your pickup note until departure. Price, seats, route and time are locked once published.",
      "Share trip sends your route, time and car to someone you trust.",
      "You can cancel until departure; riders are told when it is under 24 hours before you leave.",
    ],
  },
];

export function hasSeenOfferTour(): boolean {
  try {
    return window.localStorage.getItem(OFFER_TOUR_KEY) === "seen";
  } catch {
    // Storage blocked: do not show the demo on every visit.
    return true;
  }
}

export function markOfferTourSeen(): void {
  try {
    window.localStorage.setItem(OFFER_TOUR_KEY, "seen");
  } catch {
    /* ignore */
  }
}
