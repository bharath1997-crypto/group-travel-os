# Airport dataset — OurAirports

Rovvy flight airport browse and nearby-airport distance calculations use the
[OurAirports](https://ourairports.com/data/) open dataset.

- **File:** `data/airports.csv`
- **Source:** https://davidmegginson.github.io/ourairports-data/airports.csv
- **License:** [Open Database License (ODbL) v1.0](https://opendatacommons.org/licenses/odbl/)
- **Attribution:** Airport data from OurAirports (ourairports.com).

Autocomplete primary results may additionally come from Travelpayouts Places and,
when configured, Duffel Places suggestions. Those providers supply live IATA and
city/metro codes used for booking.

OurAirports rows without a usable three-letter IATA code are excluded from flight
picker results.
