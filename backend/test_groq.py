import asyncio
import os
from groq import AsyncGroq
from pydub import AudioSegment
from dotenv import load_dotenv

load_dotenv()

async def main():
    client = AsyncGroq(api_key=os.environ.get("GROQ_API_KEY"))
    
    # Take the first 30 seconds of the file to see what it contains
    audio = AudioSegment.from_file("saved_audio/111379_111379.wav")
    print("Duration:", len(audio)/1000)
    chunk = audio[0:300000]
    os.makedirs("temp_audio", exist_ok=True)
    chunk.export("temp_audio/test_chunk.mp3", format="mp3", bitrate="192k")
    
    with open("temp_audio/test_chunk.mp3", "rb") as f:
        resp = await client.audio.translations.create(
            file=("test_chunk.mp3", f),
            model="whisper-large-v3",
            prompt="This is a spoken interview in English and Hindi. Do not transcribe silence, background noise, or sighs.",
            response_format="verbose_json",
            temperature=0.0
        )
    print("WITH PROMPT:", resp.text)

    with open("temp_audio/test_chunk.mp3", "rb") as f:
        resp2 = await client.audio.translations.create(
            file=("test_chunk.mp3", f),
            model="whisper-large-v3",
            response_format="verbose_json",
            temperature=0.0
        )
    print("WITHOUT PROMPT:", resp2.text)

if __name__ == "__main__":
    asyncio.run(main())
