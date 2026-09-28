from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend" / "data" / "live_search_taxonomy.json"
BACKEND = ROOT / "data" / "live_search_taxonomy.json"


def test_live_search_taxonomy_mirror_is_byte_identical():
    assert FRONTEND.is_file(), "frontend taxonomy missing"
    assert BACKEND.is_file(), "data/ taxonomy missing"
    assert FRONTEND.read_bytes() == BACKEND.read_bytes()
