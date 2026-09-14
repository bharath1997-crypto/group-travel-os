export type FlightCabin = "M" | "W" | "C" | "F";

export type TicketType = "single_ticket" | "separate_tickets" | "unknown";
export type ConnectionProtection = "protected" | "unprotected" | "unknown";
export type BaggageTransfer = "automatic" | "self_transfer" | "unknown";
export type YesNoUnknown = "yes" | "no" | "unknown";

export type FlightRow = {
  id: string;
  price: number;
  currency: string;
  airlines: string[];
  departure_at: string;
  arrival_at: string;
  origin: string;
  destination: string;
  duration_minutes: number;
  deep_link: string;
  stops: number;
  score?: number;
  recommendation_reason?: string;
};

export type FlightConnectionDetail = {
  airport: string;
  airport_name: string;
  arrival_at: string | null;
  next_departure_at: string | null;
  layover_minutes: number | null;
  overnight: boolean | null;
  same_airport: boolean | null;
  airport_change: boolean | null;
  terminal_change: boolean | null;
  protected: boolean | null;
  ticket_type?: TicketType;
  connection_protection?: ConnectionProtection;
  baggage_transfer?: BaggageTransfer;
  airport_change_status?: YesNoUnknown;
  terminal_change_status?: YesNoUnknown;
  provider_disclosure_text?: string | null;
  baggage_recheck_required?: YesNoUnknown;
  source_provider?: string | null;
  source_offer_id?: string | null;
  normalized_at?: string | null;
};

export type FlightJourneySegment = FlightSegmentDetail & {
  operating_airline_code: string;
  operating_airline_name: string;
};

export type FlightJourneySlice = {
  origin: string;
  destination: string;
  duration_minutes: number;
  stops: number;
  segments: FlightJourneySegment[];
  connections: FlightConnectionDetail[];
};

export type FlightJourney = FlightRow & {
  provider: string;
  provider_offer_id: string;
  checked_at: string;
  expires_at: string;
  last_ticketing_date?: string | null;
  live_mode: boolean;
  slices: FlightJourneySlice[];
  total_duration_minutes: number;
  maximum_connections: number;
  protected_connection: boolean | null;
  ticket_type?: TicketType;
  connection_protection?: ConnectionProtection;
  baggage_transfer?: BaggageTransfer;
  separate_tickets?: boolean | null;
  self_transfer?: boolean | null;
  bookable_in_rovvy: boolean;
  carry_on_included: boolean | null;
  checked_bag_included: boolean | null;
  refundable: boolean | null;
  changeable: boolean | null;
  recommendation_score?: number | null;
};

export type SellerActionType = "external_redirect" | "provider_checkout" | "unavailable";

export type RovvyBaggageSummary = {
  carry_on_included: boolean | null;
  checked_bag_included: boolean | null;
  summary: string | null;
};

export type RovvyFareConditions = {
  refundable: boolean | null;
  changeable: boolean | null;
  summary: string | null;
};

export type RovvySellerOption = {
  provider_id: string;
  provider_offer_id: string;
  seller_id: string;
  seller_name: string;
  total_price: number;
  currency: string;
  baggage: RovvyBaggageSummary;
  fare_conditions: RovvyFareConditions;
  protected_connection: boolean | null;
  ticket_type?: TicketType;
  connection_protection?: ConnectionProtection;
  baggage_transfer?: BaggageTransfer;
  separate_tickets: boolean | null;
  self_transfer: boolean | null;
  redirect_url: string | null;
  action_type: SellerActionType;
  checked_at: string;
  expires_at: string | null;
  last_ticketing_date?: string | null;
  environment: ProviderEnvironment;
};

export type RovvyItineraryGroup = {
  itinerary_key: string;
  marketing_airlines: string[];
  operating_airlines: string[];
  slices: FlightJourneySlice[];
  total_duration_minutes: number;
  stops: number;
  departure_at: string;
  arrival_at: string;
  origin: string;
  destination: string;
  seller_options: RovvySellerOption[];
  lowest_price: number | null;
  currency: string | null;
  recommendation_score?: number | null;
  recommendation_reason?: string | null;
};

export type ProviderEnvironment = "test" | "live" | null;

export type ProviderStatusRecord = {
  provider_id: string;
  status: "ok" | "timeout" | "error" | "disabled" | "unconfigured";
  offer_count: number;
  environment: "test" | "live" | null;
  message: string | null;
  elapsed_ms: number | null;
};

export type FlightJourneySearchResponse = {
  journeys: FlightJourney[];
  itinerary_groups: RovvyItineraryGroup[];
  provider_statuses: ProviderStatusRecord[];
  providers_requested: number;
  providers_succeeded: number;
  providers_failed: number;
  offers_before_grouping?: number;
  unique_itinerary_count?: number;
  partial_results: boolean;
  searched_at: string | null;
  provider: string;
  live_mode: boolean | null;
  environment: "test" | "live" | null;
  message: string | null;
  route_recovery?: FlightRouteRecoveryOption[];
  search_metadata?: {
    strict_connection_limit: boolean;
    adaptive_attempts: Array<{
      attempt_number: number;
      maximum_connections: number;
      offer_count: number;
      group_count: number;
      status: "ok" | "timeout" | "error" | "skipped";
      elapsed_ms?: number | null;
    }>;
    merged_offer_count: number;
    merged_group_count: number;
    requested_destinations: string[];
  } | null;
};

export type FlightRouteRecoveryOption = {
  origin: string;
  destination: string;
  departure_date: string;
  tier: "nearby_origin" | "nearby_destination" | "national_gateway" | "international_gateway";
  title: string;
  explanation: string;
  origin_distance_km?: number | null;
  destination_distance_km?: number | null;
  separate_searches_required: boolean;
};

export type FlightSearchSlicePayload = {
  origin: string;
  destination: string;
  departure_date: string;
  departure_time_from?: string;
  departure_time_to?: string;
};

export type FlightSearchPassengerPayload = {
  type?: "adult" | "child" | "infant_without_seat";
  age?: number;
};

export type MultiCityLeg = {
  from: string;
  to: string;
  depart: string;
  fromLabel?: string;
  toLabel?: string;
  departureTimeFrom?: string;
  departureTimeTo?: string;
};

export type FlightSearchParams = {
  from: string;
  to: string;
  fromLabel?: string;
  toLabel?: string;
  depart: string;
  return?: string;
  adults: number;
  children: number;
  infants: number;
  cabin: FlightCabin;
  nonstop?: boolean;
  tripType?: "oneway" | "roundtrip" | "multicity";
  multiCityLegs?: MultiCityLeg[];
  maximumConnections?: number;
  strictConnectionLimit?: boolean;
  flexibleDates?: boolean;
  departureTimeFrom?: string;
  departureTimeTo?: string;
  returnDepartureTimeFrom?: string;
  returnDepartureTimeTo?: string;
};

export type FlightSortMode = "best" | "cheapest" | "fastest" | "earliest";

export type DateMatrixItem = {
  date: string;
  price: number | null;
  currency: string;
  isCheapest?: boolean;
  isSelected?: boolean;
};

export type FlightOfferPriceResult = {
  offer_id: string;
  previous_price: number | null;
  current_price: number;
  currency: string;
  price_changed: boolean;
  price_increased: boolean;
  expires_at: string;
  live_mode: boolean;
  message: string;
};

export type FlightSegmentDetail = {
  origin: string;
  origin_name: string;
  destination: string;
  destination_name: string;
  departure_at: string;
  arrival_at: string;
  duration_minutes: number;
  airline_code: string;
  airline_name: string;
  flight_number: string;
  aircraft: string;
  origin_terminal: string;
  destination_terminal: string;
};

export type FlightSliceDetail = {
  origin: string;
  destination: string;
  duration_minutes: number;
  stops: number;
  segments: FlightSegmentDetail[];
};

export type FlightOfferDetail = FlightRow & {
  slices: FlightSliceDetail[];
  cabin_class: string;
  fare_brand: string;
  expires_at: string;
  live_mode: boolean;
  carry_on_included: boolean | null;
  checked_bag_included: boolean | null;
  refundable: boolean | null;
  changeable: boolean | null;
};

export const CABIN_LABELS: Record<FlightCabin, string> = {
  M: "Economy",
  W: "Premium economy",
  C: "Business",
  F: "First",
};

export type FlightOrderPassenger = {
  id: string;
  type: string;
  given_name: string;
  family_name: string;
  email: string;
  ticket_number?: string;
};

export type FlightOrder = {
  id: string;
  booking_reference: string;
  status: "confirmed" | "pending" | "cancelled" | "failed";
  total_amount: number;
  currency: string;
  slices: FlightSliceDetail[];
  passengers: FlightOrderPassenger[];
  available_actions: string[];
  live_mode: boolean;
  created_at: string;
};

export type FlightSeat = {
  designator: string; // e.g. "12A"
  name?: string;
  disclosures?: string[];
  price?: number;
  currency?: string;
  available: boolean;
  element_type?: string;
};

export type FlightSeatMapElement = {
  type: "seat" | "aisle" | "exit" | "lavatory" | "galley" | "empty";
  seat?: FlightSeat;
};

export type FlightSeatMapRow = {
  number: number;
  elements: FlightSeatMapElement[];
};

export type FlightSeatMapCabin = {
  cabin_class: string;
  rows: FlightSeatMapRow[];
};

export type FlightSeatMap = {
  id: string;
  slice_id?: string;
  segment_id?: string;
  cabins: FlightSeatMapCabin[];
};

export type PassengerSeatSelection = {
  passengerIndex: number;
  passengerName: string;
  segmentIndex: number;
  seatDesignator: string;
  price: number;
};

export type FlightAncillaryService = {
  id: string;
  type: "baggage" | "seat" | "other";
  name: string;
  description?: string;
  price: number;
  currency: string;
  passenger_ids?: string[];
};

export type FlightCancelQuote = {
  cancellation_id: string;
  order_id: string;
  refund_amount: number;
  currency: string;
  expires_at: string;
  message: string;
};

export type FlightCancelConfirm = {
  cancellation_id: string;
  order_id: string;
  status: string;
  refund_amount: number;
  currency: string;
  message: string;
};

export function travelerSummary(params: Pick<FlightSearchParams, "adults" | "children" | "infants">): string {
  const total = params.adults + params.children + params.infants;
  if (total === 1) return "1 traveler";
  return `${total} travelers`;
}
