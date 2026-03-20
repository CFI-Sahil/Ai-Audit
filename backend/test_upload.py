import requests
import json
import os

url = "http://127.0.0.1:8000/upload-survey"
data = {
    "name": "Test User",
    "age": 25,
    "profession": "Farmer",
    "education": "Graduate",
    "location": "Pune",
    "mobile": "9999999999"
}

# Create a dummy audio file if it doesn't exist
if not os.path.exists("dummy.mp3"):
    with open("dummy.mp3", "wb") as f:
        f.write(b"0" * 1024)

files = {
    "audio": ("dummy.mp3", open("dummy.mp3", "rb"), "audio/mpeg")
}

try:
    print("Sending POST request to /upload-survey...")
    response = requests.post(url, data=data, files=files)
    print(f"Status Code: {response.status_code}")
    print("Response Body:")
    try:
        print(json.dumps(response.json(), indent=2))
    except:
        print(response.text)
except Exception as e:
    print(f"Request failed: {e}")
