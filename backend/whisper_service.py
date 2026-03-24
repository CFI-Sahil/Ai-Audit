import os
import re
import time
import math
import asyncio
import json
import uuid
import sys
from typing import List, Optional, Dict, Any
from groq import AsyncGroq
from pydub import AudioSegment
from dotenv import load_dotenv

# Load .env file
load_dotenv()

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

backend_dir = os.path.dirname(os.path.abspath(__file__))

# Cross-platform ffmpeg detection
if sys.platform == "win32":
    ffmpeg_bin = backend_dir
    if not os.path.exists(os.path.join(ffmpeg_bin, "ffmpeg.exe")):
        alt_ffmpeg_bin = os.path.join(os.path.dirname(backend_dir), "ffmpeg", "bin")
        if os.path.exists(os.path.join(alt_ffmpeg_bin, "ffmpeg.exe")):
            ffmpeg_bin = alt_ffmpeg_bin
            
    if ffmpeg_bin not in os.environ["PATH"]:
        os.environ["PATH"] += os.pathsep + ffmpeg_bin

    try:
        AudioSegment.converter = os.path.join(ffmpeg_bin, "ffmpeg.exe")
        AudioSegment.ffprobe = os.path.join(ffmpeg_bin, "ffprobe.exe")
    except Exception as e:
        print(f"DEBUG: Error setting Pydub converter (Windows): {e}")
else:
    # On Linux (Render), we assume ffmpeg is already in the system PATH
    # No need to set AudioSegment.converter explicitly if it's already in PATH
    pass

class WhisperService:
    def __init__(self, model_size="whisper-large-v3"):
        # Load multiple API keys for rotation
        self.api_keys = [os.environ.get("GROQ_API_KEY")]
        # Also check for GROQ_API_KEY_2, GROQ_API_KEY_3, etc.
        for i in range(2, 6):
            key = os.environ.get(f"GROQ_API_KEY_{i}")
            if key: self.api_keys.append(key)
        
        self.clients = [AsyncGroq(api_key=k) for k in self.api_keys]
        self.current_client_idx = 0
        self.model_name = model_size

    def _get_client(self):
        return self.clients[self.current_client_idx]

    def _rotate_client(self):
        if len(self.clients) > 1:
            self.current_client_idx = (self.current_client_idx + 1) % len(self.clients)
            print(f"DEBUG: Rotating to API Key {self.current_client_idx + 1}/{len(self.clients)}")
            return True
        return False

    def normalize_audio(self, audio: AudioSegment) -> AudioSegment:
        """Normalize audio to -20dBFS for consistent transcription."""
        change_in_dbfs = -20.0 - audio.dBFS
        return audio.apply_gain(change_in_dbfs)

    async def _groq_request(self, func, *args, **kwargs):
        """Unified wrapper for Groq API calls with robust exponential backoff and Rotation."""
        max_retries = 5
        
        for attempt in range(max_retries):
            try:
                # Use current rotated client
                client = self._get_client()
                return await func(client, *args, **kwargs)
            except Exception as e:
                err_msg = str(e).lower()
                is_rate_limit = "rate_limit" in err_msg or "429" in err_msg
                
                if is_rate_limit and attempt < max_retries - 1:
                    # Try rotating key first
                    if self._rotate_client():
                        print(f"DEBUG: Rate limit hit, switching to next API key (Attempt {attempt+1})")
                        continue # Retry immediately with new key
                    
                    # RPM limit fallback wait
                    wait_time = 21.0 
                    
                    # Try to parse exact sleep time (e.g. 2m54.5s)
                    retry_match = re.search(r'try again in (?:(\d+)m)?(\d+\.?\d*)s', err_msg)
                    if retry_match:
                        m = float(retry_match.group(1)) if retry_match.group(1) else 0
                        s = float(retry_match.group(2))
                        wait_time = (m * 60) + s + 1.0 # Add 1s padding
                    
                    print(f"WARNING: API Rate Limit Hit (Attempt {attempt+1}/{max_retries}). Sleeping {wait_time:.1f}s...")
                    await asyncio.sleep(wait_time)
                elif attempt < max_retries - 1:
                    print(f"ERROR: API Call failed (Attempt {attempt+1}/{max_retries}): {e}. Retrying in 5s...")
                    await asyncio.sleep(5)
                else:
                    print(f"CRITICAL: API Call failed after {max_retries} attempts: {e}")
                    raise e
        return None

    async def transcribe(self, audio_path: str):
        if not os.path.exists(audio_path):
            return {"text": "Error: Audio file not found.", "segments": []}
        
        print(f"--- Transcribing '{os.path.basename(audio_path)}' via Groq API (Optimized) ---")
        start_time = time.time()
        
        try:
            audio = AudioSegment.from_file(audio_path)
            audio = self.normalize_audio(audio)
            duration_sec = len(audio) / 1000.0
        except Exception as ae:
            print(f"Audio processing error: {ae}")
            return {"text": f"Error loading audio: {ae}", "segments": []}

        temp_dir = "temp_audio"
        os.makedirs(temp_dir, exist_ok=True)
        all_segments = []
        
        # 1. Try Single-Request Optimization (< 25MB)
        if duration_sec < 1500: # Files under 25 mins usually safe compressed
            try:
                full_filename = os.path.join(temp_dir, f"full_{uuid.uuid4().hex[:8]}.mp3")
                audio.export(full_filename, format="mp3", bitrate="128k")
                file_size_mb = os.path.getsize(full_filename) / (1024 * 1024)
                
                if file_size_mb < 24.0:
                    print(f"DEBUG: Processing full audio in one request ({file_size_mb:.2f} MB)...")
                    with open(full_filename, "rb") as f:
                        resp = await self._groq_request(
                            lambda c, **kw: c.audio.translations.create(**kw),
                            file=(os.path.basename(full_filename), f),
                            model=self.model_name,
                            prompt="Spoken interview between surveyor and respondent. English/Hindi mix. Identify speaker.",
                            response_format="verbose_json",
                            temperature=0.0
                        )
                    
                        if resp:
                            raw_segs = getattr(resp, 'segments', []) or getattr(resp, 'get', lambda k, d: [])('segments', [])
                            for s in raw_segs:
                                seg_data = s if isinstance(s, dict) else s.__dict__
                                all_segments.append({
                                    "text": seg_data.get("text", "").strip(),
                                    "start": seg_data.get("start", 0),
                                    "end": seg_data.get("end", 0)
                                })
                
                if os.path.exists(full_filename): os.remove(full_filename)
            except Exception as fe:
                print(f"Full audio processing skipped/failed: {fe}. Falling back to chunking...")

        # 2. Chunked Fallback (If Single Request skipped or failed)
        if not all_segments:
            chunk_duration_ms = 600 * 1000 # 10 minutes
            num_chunks = math.ceil(len(audio) / chunk_duration_ms)
            print(f"DEBUG: Processing in {num_chunks} chunks...")
            
            for i in range(num_chunks):
                if i > 0: await asyncio.sleep(2) # RPM stagger
                start_ms = i * chunk_duration_ms
                end_ms = min(start_ms + chunk_duration_ms, len(audio))
                chunk = audio[start_ms:end_ms]
                chunk_filename = os.path.join(temp_dir, f"chunk_{i}_{uuid.uuid4().hex[:8]}.mp3")
                
                try:
                    chunk.export(chunk_filename, format="mp3", bitrate="128k")
                    with open(chunk_filename, "rb") as f:
                        resp = await self._groq_request(
                            lambda c, **kw: c.audio.translations.create(**kw),
                            file=(os.path.basename(chunk_filename), f),
                            model=self.model_name,
                            prompt="Spoken interview. English/Hindi mix.",
                            response_format="verbose_json",
                            temperature=0.0
                        )
                    if resp:
                        raw_segs = getattr(resp, 'segments', []) or getattr(resp, 'get', lambda k, d: [])('segments', [])
                        offset = start_ms / 1000.0
                        for s in raw_segs:
                            seg_data = s if isinstance(s, dict) else s.__dict__
                            all_segments.append({
                                "text": seg_data.get("text", "").strip(),
                                "start": seg_data.get("start", 0) + offset,
                                "end": seg_data.get("end", 0) + offset
                            })
                finally:
                    if os.path.exists(chunk_filename): os.remove(chunk_filename)

        # 3. Final Diarization and Formatting
        if all_segments:
            all_segments = await self.identify_speakers(all_segments)
            final_text = ""
            for s in all_segments:
                speaker = s.get("speaker", "Surveyor")
                final_text += f"[{speaker}]: {s['text']}\n"
            
            elapsed = time.time() - start_time
            print(f"--- Completed in {elapsed:.1f}s (Total segments: {len(all_segments)}) ---")
            return {
                "text": final_text.strip(),
                "segments": all_segments,
                "info": {"duration": duration_sec, "language": "en"}
            }
        
        return {"text": "Transcription failed.", "segments": []}

    async def identify_speakers(self, segments: List[Dict]) -> List[Dict]:
        """Maps speakers based on '1st speaker = Surveyor' heuristic."""
        if not segments: return []
        
        sample_size = min(100, len(segments))
        sample_text = "\n".join([f"S{idx}: {s['text']}" for idx, s in enumerate(segments[:sample_size])])
        
        prompt = f"""You are a speaker role identifier.
In this survey:
- The SURVEYOR is the interviewer (usually starts the conversation, introduces themselves or the company like 'AccessMind', and asks questions).
- The RESPONDENT is the person being interviewed (answers questions about name, age, etc.).

IMPORTANT: Sometimes the Surveyor speaks multiple times at the start (e.g. introducing themselves, then asking a question). 

Analyze these segments and map the speaker IDs (S0, S1, etc.) to [Surveyor] or [Respondent].

INPUT SEGMENTS:
{sample_text}

OUTPUT FORMAT (JSON ONLY):
{{
  "S0": "Surveyor",
  "S1": "Surveyor",
  "S2": "Respondent",
  ... 
}}
"""
        try:
            response = await self._groq_request(
                lambda c, **kw: c.chat.completions.create(**kw),
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                response_format={"type": "json_object"}
            )
            if response:
                role_map = json.loads(response.choices[0].message.content)
                s0_role = role_map.get("S0", "Surveyor")
                s1_role = role_map.get("S1", "Respondent")
                
                for idx, s in enumerate(segments):
                    sid = f"S{idx}"
                    if sid in role_map:
                        s["speaker"] = role_map[sid]
                    else:
                        s["speaker"] = s0_role if idx % 2 == 0 else s1_role
            else:
                for idx, s in enumerate(segments):
                    s["speaker"] = "Surveyor" if idx % 2 == 0 else "Respondent"
            return segments
        except Exception as e:
            print(f"Speaker Identification Error: {e}")
            for idx, s in enumerate(segments):
                s["speaker"] = "Surveyor" if idx % 2 == 0 else "Respondent"
            return segments

    def _clean_transcript(self, text):
        text = re.sub(r"do not transcribe background noise or silence", "", text, flags=re.I)
        text = re.sub(r"this is an interview", "", text, flags=re.I)
        text = re.sub(r"transcription by castingwords", "", text, flags=re.I)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    async def extract_structured_info(self, transcript: str):
        """Extract user details ONLY from respondent segments."""
        if not transcript or len(transcript.strip()) < 10:
            return {"name": None, "age": None, "education": None, "profession": None, "location": None, "mobile": None}
        
        await asyncio.sleep(2)
        prompt = f"""Extract user details ONLY from segments labeled [Respondent]. 
Ignore anything the [Surveyor] says (like their own name 'Vansh Narayan Patil' or company 'AccessMind').

Focus on the Respondent's answers to questions like "What is your name?", "How old are you?", etc.

Return JSON:
{{
  "name": "Full Name",
  "age": "Number",
  "education": "Level",
  "profession": "Job",
  "location": "District/State",
  "mobile": "10 digits"
}}

Transcript:
{transcript}
"""
        try:
            response = await self._groq_request(
                lambda c, **kw: c.chat.completions.create(**kw),
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                response_format={"type": "json_object"}
            )
            if response:
                data = json.loads(response.choices[0].message.content)
                # Strict 10-digit validation
                mobile_raw = str(data.get("mobile") or "")
                clean_mobile = re.sub(r"\D", "", mobile_raw)
                if len(clean_mobile) != 10:
                    data["mobile"] = None
                else:
                    data["mobile"] = clean_mobile
                return data
            return {}
        except Exception as e:
            print(f"Extraction Error: {e}")
            return {}

    async def analyze_z_audit_issues(self, transcript: str, registration_details: Optional[List[List[str]]] = None, standard_audit: Optional[Dict] = None):
        """Forensic audit using 8B model for stability with standard audit input."""
        form_data = "\n".join([f"- {d[1]}: {d[0]}" for d in registration_details]) if registration_details else ""
        
        # Prepare standard audit summary for the prompt
        audit_summary = ""
        if standard_audit:
            statuses = standard_audit.get("statuses", {})
            detected = standard_audit.get("detected_values", {})
            audit_summary = "\nStandard Audit Results:\n"
            for field, status in statuses.items():
                val = detected.get(field, "Not Detected")
                audit_summary += f"- {field.upper()}: {status} (AI Detected: {val})\n"

        await asyncio.sleep(1) # Keep some delay for stability

        prompt = f"""Final Forensic Audit. 
Compare Transcript ([Surveyor] & [Respondent]) vs Form Data and Standard Audit Results.

Transcript:
{transcript}

Form Data:
{form_data}
{audit_summary}

Scoring Rules (MANDATORY):
1. If most fields are "Match" or "Inconclusive": Final Score 7-10.
2. If 1-2 critical fields (Name, Age, Location) are "Mismatch": Final Score 3-6.
3. If 3+ fields are "Mismatch": Final Score 0-3.
4. "Agricultural Worker" and "Farmer" are a MATCH.
5. If the respondent sounds like they are being coached/mimicking: Score < 4.

Return JSON with exactly these keys:
{{
  "final_score": 0-10,
  "payment_decision": "Full Payment" | "Partial Payment" | "No Payment",
  "issues_detected": ["Issue Label"],
  "evidence": [{{ "issue": "Label", "detail": "Detailed explanation" }}],
  "audit_summary": "Paragraph summary"
}}
"""
        try:
            response = await self._groq_request(
                lambda c, **kw: c.chat.completions.create(**kw),
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                response_format={"type": "json_object"}
            )
            if response:
                return json.loads(response.choices[0].message.content)
            return {"final_score": 0, "payment_decision": "AI Unavailable", "issues_detected": ["Rate Limit / API Error"]}
        except Exception as e:
            print(f"Audit Error: {e}")
            return {"final_score": 0, "payment_decision": "Error", "issues_detected": ["AI Error"]}

whisper_service = WhisperService()
