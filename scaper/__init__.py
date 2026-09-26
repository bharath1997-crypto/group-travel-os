"""
Scaper — ingest service that feeds Rovvy Explorer.

Runs separately from the FastAPI app and shares its Postgres database:
provider APIs -> ingest.raw_records -> public.places / public.events.
Design: Scram Book/Explorer Tab/Scaper_Connector_Architecture.md
"""
