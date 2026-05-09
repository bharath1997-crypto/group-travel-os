import httpx

def test_overpass():
    lat, lon = 25.7617, -80.1918  # Miami Center
    overpass_query = f"""
    [out:json][timeout:25];
    (
      node["tourism"~"museum|tourist_attraction|viewpoint|gallery|theme_park|zoo"](around:15000,{lat},{lon});
      way["tourism"~"museum|tourist_attraction|viewpoint|gallery|theme_park|zoo"](around:15000,{lat},{lon});
      node["leisure"="park"](around:15000,{lat},{lon});
      node["historic"](around:15000,{lat},{lon});
    );
    out body qt 12;
    """
    url = "https://overpass-api.de/api/interpreter"
    try:
        r = httpx.post(url, data={"data": overpass_query}, timeout=30)
        print(f"Status: {r.status_code}")
        data = r.json()
        elements = data.get("elements", [])
        print(f"Found {len(elements)} elements.")
        for el in elements[:5]:
            print(f"- {el.get('tags', {}).get('name')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_overpass()
