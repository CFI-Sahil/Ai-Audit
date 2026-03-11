import os
import time
from faster_whisper import WhisperModel

# 1. FFmpeg Configuration (Kept from your original setup)
ffmpeg_path = r"D:\Sahil\Zeex AI\Ai speech to text\ffmpeg-2026-03-05-git-74cfcd1c69-essentials_build\ffmpeg-2026-03-05-git-74cfcd1c69-essentials_build\bin"
if ffmpeg_path not in os.environ["PATH"]:
    os.environ["PATH"] += os.pathsep + ffmpeg_path

class WhisperService:
    def __init__(self, model_size="large-v2"):
        print(f"--- Phase 1: Loading '{model_size}' into memory ---")
        start_load = time.time()
        
        # Simple initialization
        self.model = WhisperModel(model_size)
        
        end_load = time.time()
        print(f"Model loaded in {end_load - start_load:.2f} seconds.")

    def transcribe(self, audio_path: str):
        if not os.path.exists(audio_path):
            return {"text": "Error: Audio file not found.", "segments": []}
        
        print(f"--- Phase 2: Translating {os.path.basename(audio_path)} ---")
        start_transcribe = time.time()
        
        segments, info = self.model.transcribe(
            audio_path,
            task="translate",
            beam_size=5,
            vad_filter=True,
            word_timestamps=True # Enable exact word timings
        )
        
        processed_segments = []
        full_text_list = []
        for segment in segments:
            full_text_list.append(segment.text)
            
            # Extract word-level data for precision
            words_data = []
            if segment.words:
                for w in segment.words:
                    words_data.append({
                        "word": w.word.strip(),
                        "start": w.start,
                        "end": w.end
                    })

            processed_segments.append({
                "text": segment.text.strip(),
                "start": segment.start,
                "end": segment.end,
                "words": words_data
            })
            
        full_text = " ".join(full_text_list)
        
        end_transcribe = time.time()
        print(f"Translation finished in {end_transcribe - start_transcribe:.2f} seconds.")
        
        # LOGGING FOR DEBUGGING
        print(f"--- Audio Analysis ---")
        print(f"Detected Duration: {info.duration:.2f}s")
        if processed_segments:
            print(f"First Segment Start: {processed_segments[0]['start']:.2f}s")
        
        return {
            "text": full_text.strip(),
            "segments": processed_segments,
            "info": {
                "duration": info.duration,
                "language": info.language
            }
        }

# Initialize the service
# This part takes time once, but makes every translation after it FAST
whisper_service = WhisperService("large-v2")