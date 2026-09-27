from app.services.live_capital_level import (
    CAPITAL_LEVEL_DISTRICT,
    CAPITAL_LEVEL_NATIONAL,
    CAPITAL_LEVEL_STATE_PROVINCE,
    capital_category_label,
    capital_levels_visible_at_zoom,
    capital_visible_for_zoom,
    parse_osm_capital_level,
)


def test_parse_osm_capital_yes_and_numeric():
    assert parse_osm_capital_level({"capital": "yes"}) == CAPITAL_LEVEL_NATIONAL
    assert parse_osm_capital_level({"capital": "4"}) == CAPITAL_LEVEL_STATE_PROVINCE
    assert parse_osm_capital_level({"capital": "6"}) == CAPITAL_LEVEL_DISTRICT


def test_capital_labels_by_level_and_country():
    assert capital_category_label({"capital": "yes", "name": "Ottawa"}) == "National capital"
    assert (
        capital_category_label({"capital": "4", "addr:country": "US", "name": "Topeka"})
        == "State capital"
    )
    assert (
        capital_category_label({"capital": "4", "addr:country": "CA", "name": "Toronto"})
        == "Province capital"
    )
    assert capital_category_label({"capital": "6", "name": "Springfield"}) == "District capital"


def test_zoom_tiers_hide_local_capitals_when_zoomed_out():
    assert CAPITAL_LEVEL_NATIONAL in capital_levels_visible_at_zoom(8)
    assert CAPITAL_LEVEL_STATE_PROVINCE not in capital_levels_visible_at_zoom(8)
    assert capital_visible_for_zoom({"capital": "4"}, 8) is False
    assert capital_visible_for_zoom({"capital": "4"}, 11) is True
    assert capital_visible_for_zoom({"capital": "6"}, 11) is False
    assert capital_visible_for_zoom({"capital": "6"}, 13) is True
    assert capital_visible_for_zoom({"amenity": "townhall"}, 12) is False
    assert capital_visible_for_zoom({"amenity": "townhall"}, 14) is True
