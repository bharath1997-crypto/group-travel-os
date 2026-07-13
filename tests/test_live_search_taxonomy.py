"""Tests for Live search taxonomy (data/live_search_taxonomy.json)."""
from app.services.live_search_taxonomy_service import (
    category_keyword_map,
    category_osm_queries,
    get_category_by_key,
    is_exact_category_query,
    load_taxonomy,
    resolve_category_from_query,
    taxonomy_for_api,
)


def test_taxonomy_loads():
    data = load_taxonomy()
    assert data.get("version") == 1
    assert len(data.get("categories") or []) >= 10


def test_resolve_river_vs_canal():
    assert resolve_category_from_query("river")["key"] == "rivers"
    assert resolve_category_from_query("canal")["key"] == "canals"
    assert resolve_category_from_query("rivers nearby")["key"] == "rivers"


def test_resolve_port_synonyms():
    assert resolve_category_from_query("port")["key"] == "ports"
    assert resolve_category_from_query("port location")["key"] == "ports"
    assert resolve_category_from_query("harbour")["key"] == "ports"


def test_resolve_nature_categories():
    assert resolve_category_from_query("national park")["key"] == "national_parks"
    assert resolve_category_from_query("forest")["key"] == "forests"
    assert resolve_category_from_query("rock forest")["key"] == "rock_formations"
    assert resolve_category_from_query("mountain")["key"] == "mountains"


def test_exact_category_query():
    assert is_exact_category_query("waterfalls") is True
    assert is_exact_category_query("Niagara Falls") is False


def test_osm_queries_present_for_new_categories():
    queries = category_osm_queries()
    assert "rivers" in queries
    assert "canals" in queries
    assert "ports" in queries
    assert "national_parks" in queries
    assert len(queries["ports"]) >= 2


def test_keyword_map_includes_synonyms():
    kw = category_keyword_map()
    assert kw.get("port location") == "ports"
    assert kw.get("canals") == "canals"


def test_get_category_by_key():
    cat = get_category_by_key("parks")
    assert cat is not None
    assert cat["label"] == "Parks nearby"


def test_taxonomy_api_shape():
    payload = taxonomy_for_api()
    assert "categories" in payload
    assert "groups" in payload
    assert all("key" in c and "keywords" in c for c in payload["categories"])
