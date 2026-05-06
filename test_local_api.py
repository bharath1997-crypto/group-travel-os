import requests
import json

try:
    resp = requests.get("http://127.0.0.1:8000/api/v1/explorer/feed?city=New York")
    print(f"Status: {resp.status_code}")
    data = resp.json()
    events = data.get("events", [])
    print(f"Number of events returned: {len(events)}")
    if events:
        print("First event:", json.dumps(events[0], indent=2))
    else:
        print("Full response:", json.dumps(data, indent=2))
except Exception as e:
    print(f"Error connecting to local API: {e}")
