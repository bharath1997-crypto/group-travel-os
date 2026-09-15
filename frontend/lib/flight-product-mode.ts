/**
 * Rovvy Flights Product Mode Configuration
 * 
 * Rovvy is a flight metasearch engine (search -> compare -> external redirect handoff).
 * Internal booking and checkout flows are disabled for the current product mode.
 */
export const INTERNAL_FLIGHT_CHECKOUT_ENABLED = false;

export const FLIGHT_METASEARCH_DISCLOSURES = {
  SEARCH_HEADER:
    "Search airline offers, understand routes, compare available options, and continue to the provider you choose. Rovvy does not sell or issue tickets.",
  DRAWER_FOOTER: "Compare available airline offers · Redirect to provider for booking",
  SELLER_RESPONSIBILITY:
    "Payment, ticketing, flight changes, cancellations, refunds, and customer support are handled by the selected seller. Rovvy does not issue or service tickets.",
};
