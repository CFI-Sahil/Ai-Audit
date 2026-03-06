import whisper
import os
import sys

# Ensure FFmpeg is in the PATH for this session
ffmpeg_path = r"D:\Sahil\Zeex AI\Ai speech to text\ffmpeg-2026-03-05-git-74cfcd1c69-essentials_build\ffmpeg-2026-03-05-git-74cfcd1c69-essentials_build\bin"
if ffmpeg_path not in os.environ["PATH"]:
    os.environ["PATH"] += os.pathsep + ffmpeg_path
os.environ["PATH"] += os.pathsep + os.path.dirname(os.path.abspath(__file__))

class WhisperService:
    def __init__(self, model_size="base"):
        print(f"WhisperService: Loading model '{model_size}'...")
        self.model = whisper.load_model(model_size)
        print("WhisperService: Model loaded successfully.")

    def transcribe(self, audio_path: str) -> str:
        if not os.path.exists(audio_path):
            return "Error: Audio file not found."
        
        print(f"WhisperService: Transcribing {audio_path}...")
        result = self.model.transcribe(audio_path)
        print("WhisperService: Transcription complete.")
        return result["text"].strip()

whisper_service = WhisperService()
