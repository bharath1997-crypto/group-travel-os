from app.services.flight_provider_directory_service import FlightProviderDirectoryService


def test_provider_directory_contains_exactly_500_unique_entries():
    names = [item.provider_name for page in range(1, 6) for item in FlightProviderDirectoryService.list(page=page, page_size=100).items]
    assert FlightProviderDirectoryService.list(page_size=100).total == 500
    assert len(names) == 500
    assert len({name.casefold() for name in names}) == 500


def test_provider_directory_search_and_detail():
    response = FlightProviderDirectoryService.list(query="Emirates")
    assert [item.provider_name for item in response.items] == ["Emirates"]
    detail = FlightProviderDirectoryService.get("emirates")
    assert detail is not None
    assert detail.connectivity_status == "information_only"


def test_provider_directory_can_exclude_cargo_only_entries():
    all_results = FlightProviderDirectoryService.list(query="Cargo", page_size=100)
    passenger_results = FlightProviderDirectoryService.list(query="Cargo", passenger_only=True, page_size=100)
    assert all_results.total > passenger_results.total


def test_test_environment_is_never_labeled_as_live(monkeypatch):
    monkeypatch.setattr(
        "app.services.flight_provider_directory_service.provider_registry_records",
        lambda **_: [
            type(
                "Record",
                (),
                {
                    "configured": True,
                    "status": "ok",
                    "environment": "test",
                    "provider_id": "duffel",
                    "display_name": "Duffel",
                },
            )()
        ],
    )
    detail = FlightProviderDirectoryService.get("duffel")
    assert detail is not None
    assert detail.connectivity_status == "sandbox_connected"
    assert detail.api_access_status == "sandbox_configured"
