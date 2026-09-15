"""Build Rovvy's provider prospect catalog from authoritative and curated sources."""

from __future__ import annotations

import csv
import re
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
IATA_PDF = ROOT / ".codex" / "iata-annual-review-2026.pdf"
OUTPUT = ROOT / "docs" / "flight-provider-prospect-catalog-500.csv"
IATA_SOURCE = "https://www.iata.org/contentassets/c81222d96c9a4e0bb4ff6ced0126f0bb/iata-annual-review-2026.pdf"


WRAPPED_NAMES = {
    "AlMasria Universal": "AlMasria Universal Airlines",
    "Biman Bangladesh": "Biman Bangladesh Airlines",
    "Braathens Regional": "Braathens Regional Airways",
    "Hong Kong Express": "Hong Kong Express Airways",
    "Mauritania Airlines": "Mauritania Airlines International",
    "Myanmar Airways": "Myanmar Airways International",
    "Nordic Regional Airlines": "Nordic Regional Airlines (Norra)",
    "Pakistan International": "Pakistan International Airlines",
}


SUPPLEMENTAL = [
    # Distribution, NDC, fare and schedule infrastructure.
    ("Amadeus", "gds_distribution"), ("Sabre", "gds_distribution"),
    ("Travelport", "gds_distribution"), ("TravelSky", "gds_distribution"),
    ("Navitaire", "airline_distribution_technology"), ("Accelya", "ndc_technology"),
    ("Verteil Technologies", "ndc_aggregator"), ("TPConnects Technologies", "ndc_aggregator"),
    ("Travelfusion", "flight_aggregator"), ("Mystifly", "flight_aggregator"),
    ("Duffel", "flight_api_aggregator"), ("PKFARE", "flight_aggregator"),
    ("AirGateway", "ndc_aggregator"), ("NDC.ONE", "ndc_aggregator"),
    ("TravelNDC", "ndc_aggregator"), ("Atriis", "travel_distribution_platform"),
    ("Kyte", "airline_retailing_api"), ("Spotnana", "travel_distribution_platform"),
    ("Winding Tree", "travel_distribution_platform"), ("APG Platform", "airline_distribution"),
    ("Hahn Air Technologies", "airline_distribution"), ("OAG", "flight_data"),
    ("Cirium", "flight_data"), ("FlightAware", "flight_status_data"),
    ("FlightStats", "flight_status_data"), ("Aviationstack", "flight_data_api"),
    ("AeroDataBox", "flight_data_api"), ("FlightAPI", "flight_data_api"),
    ("FlightLabs", "flight_data_api"), ("AirLabs", "flight_data_api"),
    ("SITA", "aviation_technology"), ("ATPCO", "fare_data"),
    ("OpenAirlines", "airline_technology"), ("PROS", "airline_retailing_technology"),
    ("FLYR", "airline_retailing_technology"), ("IBS Software", "airline_technology"),
    ("Hitit", "passenger_service_system"), ("Radixx", "passenger_service_system"),
    ("AeroCRS", "passenger_service_system"), ("Intelisys Aviation", "passenger_service_system"),
    # Metasearch and online travel sellers.
    ("Skyscanner", "metasearch"), ("Google Flights", "metasearch"),
    ("KAYAK", "metasearch"), ("Momondo", "metasearch"),
    ("Wego", "metasearch"), ("Jetcost", "metasearch"),
    ("Cheapflights", "metasearch"), ("FlightsFinder", "metasearch"),
    ("Kiwi.com", "ota_virtual_interlining"), ("Expedia", "ota"),
    ("Priceline", "ota"), ("Booking.com Flights", "ota"),
    ("Agoda Flights", "ota"), ("Trip.com", "ota"),
    ("Traveloka", "ota"), ("eDreams", "ota"),
    ("Opodo", "ota"), ("GO Voyages", "ota"),
    ("CheapOair", "ota"), ("OneTravel", "ota"),
    ("Orbitz", "ota"), ("Travelocity", "ota"),
    ("Hotwire", "ota"), ("Hopper", "ota"),
    ("Alternative Airlines", "ota"), ("Mytrip", "ota"),
    ("Gotogate", "ota"), ("Flightnetwork", "ota"),
    ("BudgetAir", "ota"), ("JustFly", "ota"),
    ("FlightHub", "ota"), ("Fareportal", "ota_platform"),
    ("EaseMyTrip", "ota"), ("MakeMyTrip", "ota"),
    ("Cleartrip", "ota"), ("ixigo", "ota"),
    ("Yatra", "ota"), ("Goibibo", "ota"),
    ("Paytm Travel", "ota"), ("HappyEasyGo", "ota"),
    ("Musafir", "ota"), ("Almosafer", "ota"),
    ("Rehlat", "ota"), ("Cleartrip Middle East", "ota"),
    ("Wingie", "ota"), ("Obilet", "ota"),
    ("Despegar", "ota"), ("Best Day Travel", "ota"),
    ("Almundo", "ota"), ("Viajanet", "ota"),
    ("Travelgenio", "ota"), ("Lastminute.com", "ota"),
    ("Bravofly", "ota"), ("Rumbo", "ota"),
    ("eSky", "ota"), ("Myholidays", "ota"),
    ("Travelstart", "ota"), ("FlySafair Holidays", "ota"),
    ("Webjet", "ota"), ("Flight Centre", "travel_agency"),
    ("StudentUniverse", "ota"), ("STA Travel", "travel_agency_legacy"),
    ("American Express Global Business Travel", "travel_management_company"),
    ("BCD Travel", "travel_management_company"), ("CWT", "travel_management_company"),
    ("FCM Travel", "travel_management_company"), ("Navan", "travel_management_platform"),
    ("Egencia", "travel_management_company"), ("CTM", "travel_management_company"),
    ("TravelPerk", "travel_management_platform"), ("SAP Concur Travel", "corporate_booking_tool"),
    # Additional operating airlines outside the extracted IATA member pages.
    ("Ryanair", "airline_non_iata_catalog"), ("easyJet", "airline_non_iata_catalog"),
    ("Wizz Air", "airline_non_iata_catalog"), ("Jet2.com", "airline_non_iata_catalog"),
    ("Norwegian Air Shuttle", "airline_non_iata_catalog"), ("Spirit Airlines", "airline_non_iata_catalog"),
    ("Allegiant Air", "airline_non_iata_catalog"), ("Breeze Airways", "airline_non_iata_catalog"),
    ("Avelo Airlines", "airline_non_iata_catalog"), ("Sunwing Airlines", "airline_non_iata_catalog"),
    ("Air North", "airline_non_iata_catalog"), ("Canadian North", "airline_non_iata_catalog"),
    ("Flair Airlines", "airline_non_iata_catalog"), ("PAL Airlines", "airline_non_iata_catalog"),
    ("Air Inuit", "airline_non_iata_catalog"), ("Pascan Aviation", "airline_non_iata_catalog"),
    ("Contour Airlines", "airline_non_iata_catalog"), ("Cape Air", "airline_non_iata_catalog"),
    ("Tradewind Aviation", "airline_non_iata_catalog"), ("JSX", "airline_non_iata_catalog"),
    ("Southern Airways Express", "airline_non_iata_catalog"), ("Silver Airways", "airline_non_iata_catalog"),
    ("Air Wisconsin", "airline_non_iata_catalog"), ("Republic Airways", "airline_non_iata_catalog"),
    ("SkyWest Airlines", "airline_non_iata_catalog"), ("CommuteAir", "airline_non_iata_catalog"),
    ("Endeavor Air", "airline_non_iata_catalog"), ("PSA Airlines", "airline_non_iata_catalog"),
    ("Envoy Air", "airline_non_iata_catalog"), ("Piedmont Airlines", "airline_non_iata_catalog"),
    ("Mesa Airlines", "airline_non_iata_catalog"), ("Rex Airlines", "airline_non_iata_catalog"),
    ("Airnorth", "airline_non_iata_catalog"), ("Alliance Airlines", "airline_non_iata_catalog"),
    ("Jetstar Airways", "airline_non_iata_catalog"), ("Bonza", "airline_non_iata_catalog"),
    ("Virgin Samoa", "airline_non_iata_catalog"), ("Sounds Air", "airline_non_iata_catalog"),
    ("Originair", "airline_non_iata_catalog"), ("Barrier Air", "airline_non_iata_catalog"),
    ("Air Chathams", "airline_non_iata_catalog"), ("Sunair Aviation", "airline_non_iata_catalog"),
    ("Star Air India", "airline_non_iata_catalog"), ("FlyBig", "airline_non_iata_catalog"),
    ("IndiaOne Air", "airline_non_iata_catalog"), ("Fly91", "airline_non_iata_catalog"),
    ("Alliance Air India", "airline_non_iata_catalog"), ("SpiceXpress", "airline_non_iata_catalog"),
    ("AirAsia", "airline_non_iata_catalog"), ("Thai AirAsia", "airline_non_iata_catalog"),
    ("Indonesia AirAsia", "airline_non_iata_catalog"), ("Philippines AirAsia", "airline_non_iata_catalog"),
    ("AirAsia Cambodia", "airline_non_iata_catalog"), ("AirAsia X", "airline_non_iata_catalog"),
    ("Thai AirAsia X", "airline_non_iata_catalog"), ("Spring Airlines", "airline_non_iata_catalog"),
    ("Peach Aviation", "airline_non_iata_catalog"), ("ZIPAIR Tokyo", "airline_non_iata_catalog"),
    ("Air Do", "airline_non_iata_catalog"), ("Solaseed Air", "airline_non_iata_catalog"),
    ("StarFlyer", "airline_non_iata_catalog"), ("Fuji Dream Airlines", "airline_non_iata_catalog"),
    ("T'way Air", "airline_non_iata_catalog"), ("Air Busan", "airline_non_iata_catalog"),
    ("Air Seoul", "airline_non_iata_catalog"), ("Aero K", "airline_non_iata_catalog"),
    ("Air Premia", "airline_non_iata_catalog"), ("Greater Bay Airlines", "airline_non_iata_catalog"),
    ("HK Express", "airline_non_iata_catalog"), ("Starlux Airlines", "airline_non_iata_catalog"),
    ("Tigerair Taiwan", "airline_non_iata_catalog"), ("Firefly", "airline_non_iata_catalog"),
    ("Batik Air Indonesia", "airline_non_iata_catalog"), ("Super Air Jet", "airline_non_iata_catalog"),
    ("TransNusa", "airline_non_iata_catalog"), ("Pelita Air", "airline_non_iata_catalog"),
    ("Wings Air", "airline_non_iata_catalog"), ("Nam Air", "airline_non_iata_catalog"),
    ("Sriwijaya Air", "airline_non_iata_catalog"), ("Citilink Indonesia", "airline_non_iata_catalog"),
    ("Vietravel Airlines", "airline_non_iata_catalog"), ("Pacific Airlines", "airline_non_iata_catalog"),
    ("Cambodia Angkor Air", "airline_non_iata_catalog"), ("Sky Angkor Airlines", "airline_non_iata_catalog"),
    ("Lanmei Airlines", "airline_non_iata_catalog"), ("Myanmar Airways International", "airline_non_iata_catalog"),
    ("Air KBZ", "airline_non_iata_catalog"), ("Mann Yadanarpon Airlines", "airline_non_iata_catalog"),
    ("Golden Myanmar Airlines", "airline_non_iata_catalog"), ("Buddha Air", "airline_non_iata_catalog"),
    ("Yeti Airlines", "airline_non_iata_catalog"), ("Shree Airlines", "airline_non_iata_catalog"),
    ("Nova Airways", "airline_non_iata_catalog"), ("US-Bangla Airlines", "airline_non_iata_catalog"),
]


def extract_iata_members() -> list[str]:
    reader = PdfReader(IATA_PDF)
    lines: list[str] = []
    for page_index in (2, 3):
        text = reader.pages[page_index].extract_text() or ""
        lines.extend(part.strip() for part in text.splitlines())

    excluded = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ") | {
        "MEMBERS LIST", "IATA Annual Review 2026", "3", "4", "Airlines",
        "International", "Airways", "(Norra)",
    }
    names: list[str] = []
    for line in lines:
        line = re.sub(r"\s+", " ", line).strip()
        if not line or line in excluded:
            continue
        if line in WRAPPED_NAMES:
            names.append(WRAPPED_NAMES[line])
            continue
        if any(line == suffix for suffix in ("Airlines", "International", "Airways", "(Norra)")):
            continue
        names.append(line)
    return list(dict.fromkeys(names))


def main() -> None:
    members = extract_iata_members()
    rows: list[dict[str, str | int]] = []
    seen: set[str] = set()

    def add(name: str, provider_type: str, source: str, source_status: str) -> None:
        key = re.sub(r"[^a-z0-9]", "", name.casefold())
        if key in seen or len(rows) >= 500:
            return
        seen.add(key)
        passenger_fit = "review_required"
        if any(token in name.casefold() for token in ("cargo", "dhl", "fedex", "ups", "postal")):
            passenger_fit = "unlikely_cargo_only"
        rows.append({
            "catalog_id": len(rows) + 1,
            "provider_name": name,
            "provider_type": provider_type,
            "passenger_search_fit": passenger_fit,
            "api_access_status": "not_verified_contact_required",
            "commercial_permission_status": "not_verified_contact_required",
            "recommended_wave": "research_backlog",
            "source_status": source_status,
            "source": source,
            "notes": "Catalog inclusion is not API access, inventory permission, or ticketing authority.",
        })

    for name in members:
        add(name, "iata_member_airline", IATA_SOURCE, "official_iata_2026_member_list")
    for name, provider_type in SUPPLEMENTAL:
        add(name, provider_type, "curated_market_research", "requires_individual_verification")

    if len(rows) != 500:
        raise RuntimeError(f"Expected exactly 500 unique providers, generated {len(rows)}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} providers to {OUTPUT}")
    print(f"IATA members extracted: {len(members)}")


if __name__ == "__main__":
    main()
