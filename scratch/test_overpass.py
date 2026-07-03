import asyncio
import httpx

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

async def test():
    query = '[out:json][timeout:10];\n(\nnode["amenity"="fuel"](around:500,41.8781,-87.6298);\n);\nout center;'
    
    for url in ENDPOINTS:
        print(f"\nTesting: {url}")
        try:
            async with httpx.AsyncClient() as c:
                r = await c.post(
                    url,
                    data={"data": query},
                    timeout=15.0,
                    headers={"User-Agent": "Rovvy/1.0 (group-travel-os)"}
                )
                print(f"  Status: {r.status_code}")
                if r.status_code == 200:
                    data = r.json()
                    elements = data.get("elements", [])
                    print(f"  Elements: {len(elements)}")
                    for el in elements[:2]:
                        print(f"   - {el.get('tags', {}).get('name', 'no-name')} {el.get('lat')},{el.get('lon')}")
                else:
                    print(f"  Response: {r.text[:100]}")
        except Exception as e:
            print(f"  Error: {e}")

asyncio.run(test())
