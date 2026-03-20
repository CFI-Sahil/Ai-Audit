import asyncio
import os
from groq import AsyncGroq
from pydub import AudioSegment

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Set FFmpeg path for pydub
backend_dir = os.path.dirname(os.path.abspath(__file__))
os.environ["PATH"] += os.pathsep + backend_dir
AudioSegment.converter = os.path.join(backend_dir, "ffmpeg.exe")

async def test_segments():
    client = AsyncGroq(api_key=GROQ_API_KEY)
    chunk_path = "debug_chunk.mp3"
    
    # Ensure file exists
    if not os.path.exists(chunk_path):
        from pydub.generators import Sine
        Sine(440).to_audio_segment(duration=1000).export(chunk_path, format="mp3")
    
    print(f"Testing with {chunk_path}...")
    
    endpoints = ["translations", "transcriptions"]
    for ep in endpoints:
        print(f"\n--- Testing {ep} ---")
        try:
            with open(chunk_path, "rb") as f:
                if ep == "translations":
                    response = await client.audio.translations.create(
                        file=(os.path.basename(chunk_path), f),
                        model="whisper-large-v3",
                        response_format="verbose_json"
                    )
                else:
                    response = await client.audio.transcriptions.create(
                        file=(os.path.basename(chunk_path), f),
                        model="whisper-large-v3",
                        response_format="verbose_json",
                        language="en"
                    )
            
            # Use model_dump for Pydantic v2
            data = response.model_dump()
            print("Response Keys:", data.keys())
            
            segs = data.get("segments", [])
            print(f"Number of segments ({ep}): {len(segs)}")
            if segs:
                print("First segment text:", segs[0].get("text"))
            
        except Exception as e:
            print(f"Error with {ep}: {e}")

if __name__ == "__main__":
    asyncio.run(test_segments())
