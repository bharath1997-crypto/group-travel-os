"""Load OSM POIs from a Geofabrik regional PBF (bounded extract)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterator

# Chicago metro bbox (pilot)
CHICAGO_BBOX = (41.644, -87.94, 42.03, -87.52)  # south, west, north, east


@dataclass(frozen=True)
class OsmPoi:
    osm_id: int
    osm_type: str
    lat: float
    lon: float
    name: str | None
    tags: dict[str, Any]


def _in_bbox(lat: float, lon: float, bbox: tuple[float, float, float, float]) -> bool:
    south, west, north, east = bbox
    return south <= lat <= north and west <= lon <= east


def iter_osm_pois_from_pbf(pbf_path: str, bbox: tuple[float, float, float, float] = CHICAGO_BBOX) -> Iterator[OsmPoi]:
    """
    Stream named nodes/ways with tags from a .osm.pbf file inside bbox.
    Requires `osmium` (pip install osmium).
    """
    try:
        import osmium
    except ImportError as exc:
        raise RuntimeError(
            "Install osmium to read Geofabrik PBF: pip install osmium"
        ) from exc

    class Handler(osmium.SimpleHandler):
        def __init__(self) -> None:
            super().__init__()
            self.items: list[OsmPoi] = []

        def _maybe_add(self, osm_type: str, oid: int, lat: float, lon: float, tags: osmium.TagList) -> None:
            if not _in_bbox(lat, lon, bbox):
                return
            tag_map = {t.k: t.v for t in tags}
            name = tag_map.get("name")
            if not name and not tag_map.get("wikidata"):
                return
            self.items.append(
                OsmPoi(
                    osm_id=oid,
                    osm_type=osm_type,
                    lat=lat,
                    lon=lon,
                    name=name,
                    tags=tag_map,
                )
            )

        def node(self, n: osmium.Node) -> None:
            if not n.tags:
                return
            self._maybe_add("node", n.id, n.location.lat, n.location.lon, n.tags)

        def way(self, w: osmium.Way) -> None:
            if not w.tags:
                return
            try:
                lat = w.nodes[0].lat
                lon = w.nodes[0].lon
            except (IndexError, osmium.InvalidLocationError):
                return
            self._maybe_add("way", w.id, lat, lon, w.tags)

    handler = Handler()
    handler.apply_file(pbf_path, locations=True)
    yield from handler.items


def osm_source_url(poi: OsmPoi) -> str:
    return f"https://www.openstreetmap.org/{poi.osm_type}/{poi.osm_id}"
