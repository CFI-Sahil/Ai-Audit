import os
import time
import math
import asyncio
from groq import AsyncGroq
from pydub import AudioSegment
from dotenv import load_dotenv

# Load .env file if it exists
load_dotenv()

# API Key should be set as an environment variable GROQ_API_KEY
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

# 1. FFmpeg Configuration (Direct Backend Path)
backend_dir = os.path.dirname(os.path.abspath(__file__))

# Construct path directly to backend where ffmpeg.exe exists
ffmpeg_bin = backend_dir

print(f"DEBUG: Looking for FFmpeg at: {ffmpeg_bin}")

if os.path.exists(os.path.join(ffmpeg_bin, "ffmpeg.exe")):
    if ffmpeg_bin not in os.environ["PATH"]:
        os.environ["PATH"] += os.pathsep + ffmpeg_bin
    print(f"DEBUG: FFmpeg found and added to PATH.")
else:
    # Try the alternative path from find_by_name if backend fails
    alt_ffmpeg_bin = os.path.join(
        os.path.dirname(backend_dir),
        "ffmpeg-2026-03-05-git-74cfcd1c69-essentials_build",
        "ffmpeg-2026-03-05-git-74cfcd1c69-essentials_build",
        "bin"
    )
    if os.path.exists(os.path.join(alt_ffmpeg_bin, "ffmpeg.exe")):
        ffmpeg_bin = alt_ffmpeg_bin
        if ffmpeg_bin not in os.environ["PATH"]:
            os.environ["PATH"] += os.pathsep + ffmpeg_bin
        print(f"DEBUG: FFmpeg found at alternative path and added to PATH.")
    else:
        print(f"WARNING: FFmpeg NOT FOUND. Audio chunking may fail.")

# Pydub setting
try:
    AudioSegment.converter = os.path.join(ffmpeg_bin, "ffmpeg.exe")
    AudioSegment.ffprobe = os.path.join(ffmpeg_bin, "ffprobe.exe")
except Exception as e:
    print(f"DEBUG: Error setting Pydub converter: {e}")

class WhisperService:
    def __init__(self, model_size="whisper-large-v3"):
        print(f"--- Groq API Initialized ('{model_size}' model) ---")
        self.client = AsyncGroq(api_key=GROQ_API_KEY)
        self.model_name = model_size

    async def transcribe(self, audio_path: str):
        if not os.path.exists(audio_path):
            return {"text": "Error: Audio file not found.", "segments": []}
        
        print(f"--- Transcribing '{os.path.basename(audio_path)}' via Groq API ---")
        start_time = time.time()
        
        # Determine duration for chunking logic
        try:
            # Using Pydub to load and potentially chunk audio
            audio = AudioSegment.from_file(audio_path)
            duration_sec = len(audio) / 1000.0
        except Exception as ae:
            print(f"Pydub/FFmpeg error: {ae}")
            return {"text": f"Error loading audio: {ae}", "segments": []}
        
        # Groq has a 25MB limit. User requested 30-60s chunks for long audio.
        chunk_length_ms = 60 * 1000 # 60 seconds
        all_segments = []
        full_text_list = []
        
        num_chunks = math.ceil(len(audio) / chunk_length_ms)
        
        for i in range(num_chunks):
            start_ms = i * chunk_length_ms
            end_ms = min((i + 1) * chunk_length_ms, len(audio))
            
            chunk = audio[start_ms:end_ms]
            temp_dir = "temp_audio"
            os.makedirs(temp_dir, exist_ok=True)
            chunk_filename = os.path.join(temp_dir, f"chunk_{int(time.time())}_{i}.mp3")
            
            try:
                # Export chunk synchronously (safe from subprocess deadlocks)
                chunk.export(chunk_filename, format="mp3", bitrate="192k")
                
                print(f"DEBUG: Sending chunk {i} to Groq...")
                with open(chunk_filename, "rb") as file:
                    response = await self.client.audio.translations.create(
                        file=(os.path.basename(chunk_filename), file),
                        model=self.model_name,
                        response_format="verbose_json",
                        temperature=0.0,
                        prompt="Format: Conversation. This is an interview. Do not transcribe background noise or silence."
                    )
                
                print(f"DEBUG: Groq response for chunk {i} received.")
                
                # Extract text
                c_text = getattr(response, 'text', "")
                full_text_list.append(str(c_text))
                
                # Extract segments
                c_segments = []
                if hasattr(response, 'segments') and response.segments:
                    c_segments = response.segments
                elif isinstance(response, dict) and 'segments' in response:
                    c_segments = response['segments']
                
                # Setup timestamps
                offset = start_ms / 1000.0
                for seg in c_segments:
                    if isinstance(seg, dict):
                        s_start = float(seg.get('start', 0)) + offset
                        s_end = float(seg.get('end', 0)) + offset
                        s_text = seg.get('text', '')
                    else:
                        s_start = float(getattr(seg, 'start', 0)) + offset
                        s_end = float(getattr(seg, 'end', 0)) + offset
                        s_text = getattr(seg, 'text', '')

                    all_segments.append({
                        "text": s_text.strip(),
                        "start": s_start,
                        "end": s_end,
                        "words": []
                    })
                
            except Exception as e:
                print(f"Groq API Error on chunk {i}: {e}")
                if "rate_limit" in str(e).lower():
                    print("Rate limit hit, waiting 5s...")
                    await asyncio.sleep(5)
            finally:
                if os.path.exists(chunk_filename):
                    os.remove(chunk_filename)
        
        full_text = " ".join(full_text_list)
        
        end_time = time.time()
        print(f"Translation/Transcription finished in {end_time - start_time:.2f} seconds.")
        print(f"--- Audio Analysis ---")
        print(f"Duration: {duration_sec:.2f}s")
        if all_segments:
            print(f"First Segment Start: {all_segments[0]['start']:.2f}s")
        
        return {
            "text": full_text.strip(),
            "segments": all_segments,
            "info": {
                "duration": duration_sec,
                "language": "en"
            }
        }

# Initializing with Groq
whisper_service = WhisperService("whisper-large-v3")