import requests
import json

def test_weather():
    lat, lon = 16.3067, 80.4365 # Guntur
    url = f"http://localhost:8000/api/v1/explore/weather?city=Guntur&lat={lat}&lon={lon}"
    try:
        r = requests.get(url)
        print(json.dumps(r.json(), indent=2))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_weather()
