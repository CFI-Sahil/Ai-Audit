import asyncio
import os
import sys
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from whisper_service import whisper_service

async def test_gemini():
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not found in .env")
        return

    print(f"Gemini API Key: {api_key[:10]}...")
    
    # Check if we have any audio file in saved_audio to test with
    audio_dir = "backend/saved_audio"
    if not os.path.exists(audio_dir):
        print("saved_audio directory not found.")
        return
    
    files = [f for f in os.listdir(audio_dir) if f.endswith((".wav", ".mp3"))]
    if not files:
        print("No audio files found in saved_audio for testing.")
        return
    
    test_file = os.path.join(audio_dir, files[0])
    print(f"Testing with file: {test_file}")
    
    try:
        timestamps = await whisper_service.get_gemini_timestamps(test_file)
        print("Gemini Timestamps Response:")
        print(timestamps)
    except Exception as e:
        print(f"Test failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_gemini())
