import os
import re
import time
import math
import asyncio
from typing import List, Optional, Dict, Any
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
                        prompt="This is a recorded survey interview. Please provide a clean transcript of the conversation."
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

    def _clean_transcript(self, text):
        text = re.sub(r"do not transcribe background noise or silence", "", text, flags=re.I)
        text = re.sub(r"this is an interview", "", text, flags=re.I)
        text = re.sub(r"transcription by castingwords", "", text, flags=re.I)
        text = re.sub(r"translating", "", text, flags=re.I)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    def _extract_qa(self, transcript):
        lines = re.split(r'[.?\n]', transcript)
        qa = []
        last_question = None
        for line in lines:
            line = line.strip()
            if not line: continue
            if (line.lower().startswith(("what", "do", "is", "have")) or "?" in line):
                last_question = line
            elif last_question:
                qa.append({"question": last_question, "answer": line})
                last_question = None
        return qa

    def _format_for_llm(self, qa):
        return "\n".join([f"Q: {q['question']}\nA: {q['answer']}" for q in qa])

    def _validate_output(self, response_text):
        import json
        try:
            # Handle potential markdown blocks
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            data = json.loads(response_text)
            # clean mobile
            if data.get("mobile"):
                match = re.search(r"\d{10}", str(data["mobile"]))
                data["mobile"] = match.group(0) if match else None
            # clean age
            if data.get("age"):
                try:
                    match = re.search(r"\d+", str(data["age"]))
                    data["age"] = int(match.group(0)) if match else None
                except:
                    data["age"] = None
            return data
        except Exception as e:
            print(f"Validation error: {e}")
            return None

    async def extract_structured_info(self, transcript: str):
        """Advanced extraction pipeline using cleaning, Q&A, and Llama 3.3 70B."""
        if not transcript or len(transcript.strip()) < 10:
            return {
                "name": None, "age": None, "education": None,
                "profession": None, "location": None, "mobile": None
            }
        
        print("--- Starting Advanced Extraction Pipeline ---")
        
        # 1. Clean Transcript
        clean_text = self._clean_transcript(transcript)
        
        # 2. Extract Q&A Pairs
        qa_pairs = self._extract_qa(clean_text)
        
        # 3. Format for LLM
        formatted_text = self._format_for_llm(qa_pairs)
        if not formatted_text:
            formatted_text = clean_text # Fallback if Q&A extraction fails
            
        print(f"DEBUG: Formatted Q&A length: {len(formatted_text)}")

        prompt = f"""Extract user details ONLY from answers given by the respondent.

Rules:
- Ignore questions
- Use only answers
- If multiple answers → choose most relevant
- If unclear or conflicting → return null

Return JSON:
{{
  "name": "",
  "age": "",
  "education": "",
  "profession": "",
  "location": "",
  "mobile": ""
}}

Data:
{formatted_text}
"""
        try:
            print("--- Requesting Llama 3.3 70B via Groq ---")
            response = await self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that outputs only JSON."},
                    {"role": "user", "content": prompt}
                ],
                model="llama-3.3-70b-versatile",
                temperature=0,
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            
            # 5. Validation Layer
            final_data = self._validate_output(content)
            
            if not final_data:
                print("WARNING: Validation failed, returning null structure.")
                return {
                    "name": None, "age": None, "education": None,
                    "profession": None, "location": None, "mobile": None
                }
                
            print(f"DEBUG: Pipeline Structured Data: {final_data}")
            return final_data

        except Exception as e:
            print(f"Error in Advanced extraction pipeline: {e}")
            return {
                "name": None, "age": None, "education": None,
                "profession": None, "location": None, "mobile": None
            }


    async def analyze_z_audit_issues(self, transcript: str, registration_details: Optional[List[List[str]]] = None):
        """Specially aimed at Z-AUDIT automated issue detection."""
        if not transcript or len(transcript.strip()) < 10:
            return {
                "is_fake_form": True, "fake_form_reason": "Empty transcript.",
                "is_mimicry": False, "is_force_survey": False, "is_multiple_respondents": False, "is_data_mismatch": False
            }
        
        reg_text = ""
        if registration_details:
            reg_text = "\nRegistration Details:\n" + "\n".join([f"- {d[1]}: {d[0]}" for d in registration_details])

        prompt = f"""You are a forensic auditor. Analyze the transcript for signs of fraud or low quality.

Detect:
1. Fake Form: Is it just noise, silence, or meaningless/repetitive words?
2. Mimicry: Does the surveyor seem to be answering for the respondent? Look for same tone/fast speed without pause.
3. Force Survey: Does it seem like the respondent is being forced or answers are being 'manufactured'?
4. Multiple Respondents: Are there more than two distinct voices (surveyor + 1 respondent)?
5. Data Mismatch: Does information in the transcript contradict registration details?

Transcript:
{transcript}
{reg_text}

Return JSON ONLY:
{{
  "is_fake_form": bool,
  "fake_form_reason": "string or null",
  "is_mimicry": bool,
  "mimicry_reason": "string or null",
  "is_force_survey": bool,
  "force_survey_reason": "string or null",
  "is_multiple_respondents": bool,
  "multiple_respondents_reason": "string or null",
  "is_data_mismatch": bool,
  "data_mismatch_reason": "string or null"
}}
"""
        try:
            print("--- Running Z-AUDIT Issue Scanner (Llama 3.3 70B) ---")
            response = await self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a forensic auditor. Return JSON only."},
                    {"role": "user", "content": prompt}
                ],
                model="llama-3.3-70b-versatile",
                temperature=0,
                response_format={"type": "json_object"}
            )
            import json
            data = json.loads(response.choices[0].message.content)
            return data
        except Exception as e:
            print(f"Error in Issue Scanner: {e}")
            return {}

# Initializing with Groq
whisper_service = WhisperService("whisper-large-v3")