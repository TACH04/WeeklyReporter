import requests

BASE_URL = "http://localhost:5001/api"

print("Testing /api/sync...")
try:
    res = requests.post(f"{BASE_URL}/sync")
    print(f"Status: {res.status_code}")
    print(res.json())
except Exception as e:
    print(f"Sync failed: {e}")

print("\nTesting /api/data...")
try:
    res = requests.get(f"{BASE_URL}/data")
    print(f"Status: {res.status_code}")
    data = res.json()
    print(f"Got {len(data)} residents")
    if data:
        print(f"Sample: {data[0]}")
except Exception as e:
    print(f"Data fetch failed: {e}")

print("\nTesting /api/export...")
try:
    res = requests.get(f"{BASE_URL}/export")
    print(f"Status: {res.status_code}")
    export_data = res.json()
    print(f"Filename: {export_data.get('filename')}")
    print("Preview of first 200 chars:")
    print(export_data.get('text', '')[:200])
except Exception as e:
    print(f"Export failed: {e}")
