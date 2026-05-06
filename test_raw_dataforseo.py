import base64
import json
import logging
import os
import requests
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.DEBUG)

def run_raw_test():
    login = os.getenv("DATAFORSEO_LOGIN")
    password = os.getenv("DATAFORSEO_PASSWORD")
    
    if not login or not password:
        print("ERROR: Credentials missing in .env")
        return
        
    print("--- RAW API TEST ---")
    credentials = f"{login}:{password}"
    encoded = base64.b64encode(credentials.encode("utf-8")).decode("utf-8")
    
    # Absolute bare-minimum payload
    payload = [{
        "keyword": "music events in Chicago",
        "location_code": 2840,
        "language_code": "en"
    }]
    
    print(f"Sending payload: {json.dumps(payload)}")
    
    resp = requests.post(
        "https://api.dataforseo.com/v3/serp/google/events/live/advanced",
        json=payload,
        headers={"Authorization": f"Basic {encoded}", "Content-Type": "application/json"}
    )
    
    print("\nSTATUS:", resp.status_code)
    print("RESPONSE BODY:")
    print(json.dumps(resp.json(), indent=2))

if __name__ == "__main__":
    run_raw_test()
