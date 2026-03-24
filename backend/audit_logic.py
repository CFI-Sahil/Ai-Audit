from typing import Optional, List, Dict, Any
import re
import os
import json
import opensmile
from transformers import pipeline

def format_seconds(seconds: float) -> str:
    """Convert seconds to M:SS format (e.g. 0:19)."""
    if seconds is None: return "Not Detected"
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m}:{s:02}"

# ---------------------------------------------------------------------------
# EXTRACTION HELPERS — tightened to avoid garbage matches
# ---------------------------------------------------------------------------

def extract_age(text: str):
    """
    Extract a plausible human age (5–99) from translated English text.
    Prioritises explicit age phrases; never returns a bare number unless it
    appears right next to an age-marker word.
    """
    # Pattern 1 – explicit phrasing: "I am 19", "age is 19", "I'm 19 years old"
    age_patterns = [
        r'(?:my age is|age is|i am|i\'m|am)\s+(\d{1,2})\s*(?:years?|yrs?|yo|old)?',
        r'(\d{1,2})\s*(?:years old|year old|year-old)',
        r'\bage\s*[:\-]?\s*(\d{1,2})\b',
        # Hindi-transliterated
        r'(?:umr|umar|ayu)\s*(?:hai|he|hoon|hun|aahe)?\s*(\d{1,2})',
    ]
    for pattern in age_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            val = int(match.group(1))
            if 5 <= val <= 99:          # sanity range
                return val

    # Pattern 2 – "X years" where X looks like an age
    m = re.search(r'\b(\d{1,2})\s*(?:years?|saal|sal)\b', text, re.IGNORECASE)
    if m:
        val = int(m.group(1))
        if 5 <= val <= 99:
            return val

    return None


def extract_name(text: str):
    """
    Extract a person's name.
    • Matches 'My name is X', 'I am X', 'This is X', etc.
    • Rejects single-letter tokens, stopwords, and domain noise-words.
    • Requires the name token to start with a capital letter (post-ASR
      translation capitalisation is usually preserved).
    """
    noise_words = {
        "panchayat", "village", "district", "block", "tehsil", "mandal",
        "state", "india", "working", "from", "living", "staying", "office",
        "government", "survey", "audit", "system", "interview", "axis",
        "mind", "okay", "yes", "no", "not", "the", "this", "that", "here",
        "there", "a", "an", "in", "at", "on", "for", "to", "of", "and",
        "contact", "personal", "information", "service", "hand", "name",
    }

    patterns = [
        # Surveyor asked "What is your name?" → next speaker says it
        r'(?:my name is|name is|name\'s)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
        r'(?:i am|i\'m|this is|call me|myself)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
        # Catch "Chetan Mani." style answer after a name-question cue
        r'(?:name is|naam hai|naam)\s*[:\-]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            val = match.group(1).strip()
            # Reject if any token is a noise word or too short
            tokens = val.lower().split()
            if any(t in noise_words for t in tokens):
                continue
            if all(len(t) >= 2 for t in tokens):
                return val

    return None


def extract_education(text: str):
    """Extract education level mentioned in transcript."""
    # Map of regex → canonical label
    edu_map = [
        (r'\bpost\s?gradu\w*\b',         "postgraduate"),
        (r'\bgradu\w*\b',                 "graduate"),
        (r'\b(?:12th|hsc|intermediate)\b',"12th"),
        (r'\b(?:10th|ssc|matriculat\w*)\b',"10th"),
        (r'\bdiploma\b',                  "diploma"),
        (r'\bsecondary\b',                "secondary"),
        (r'\bprimary\b',                  "primary"),
    ]
    for pattern, label in edu_map:
        if re.search(pattern, text, re.IGNORECASE):
            return label
    return None


def extract_district(text: str):
    """
    Detect a location/district from the transcript.
    Handles multi-part names like "Khuraj, Loha Taluka, Nanded District".
    """
    patterns = [
        # Catch Resides in [X] or Village [X] or District [X]
        r'(?:resides? in|lives? in|staying in|residing in|village is|district is|from|place is|location is|at)\s+([A-Z][a-z\s,]{3,50}?(?:\bDistrict\b|\bTaluka\b|\bVillage\b|$))',
        # Catch multi-word capitalized sequences
        r'(?:resides? in|lives? in|staying in|residing in|at)\s+([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*(?:\s+[A-Z][a-z]+)*)',
    ]
    stopwords = {"from", "india", "here", "there", "this", "that", "the", "your",
                 "my", "his", "her", "very", "where", "what", "which", "work"}

    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            val = match.group(1).strip()
            # Clean trailing punctuation
            val = re.sub(r'[.,]$', '', val)
            if len(val) >= 4 and val.lower() not in stopwords:
                return val.lower()
    return None


def extract_profession(text: str, form_profession: Optional[str] = None):
    """Detect profession keywords in translated text."""
    patterns = [
        r'(?:my profession is|occupation is|job is|work as a?|working as a?)\s+'
        r'([a-zA-Z\s]{3,25}?)(?:\.|,|\band\b|\bi\s+earn\b|\bis\b|$)',
        r'(?:i am a|i\'m a|i am an|i\'m an)\s+'
        r'([a-zA-Z\s]{3,25}?)(?:\.|,|\band\b|\bwhat\b|\bi\s+earn\b|$)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            prof = match.group(1).strip().lower()
            prof = re.split(r'\s+(?:what|is|and|i)\s+', prof)[0].strip()
            if len(prof) >= 3:
                return prof

    if form_profession:
        f_prof = str(form_profession).lower().strip()
        if re.search(rf'\b{re.escape(f_prof)}\b', text, re.IGNORECASE):
            return f_prof
    return None


def extract_mobile(text: str):
    """
    Extract a 10-digit Indian mobile number.
    Strictly matches 10 digits starting with 6-9, allowing optional separators.
    Does NOT use global cleaning to avoid concatenating non-adjacent digits (hallucinations).
    """
    if not text:
        return None

    # Pattern: 10 digits starting with 6-9, allowing optional spaces/dots/dashes between them
    # Example: 987 654 3210 or 9876543210
    pattern = r'[6789](?:[\s.\-]?\d){9}'
    
    match = re.search(pattern, text)
    if match:
        clean = re.sub(r'\D', '', match.group(0))
        if len(clean) == 10:
            return clean

    return None


# ---------------------------------------------------------------------------
# MATCHING HELPERS
# ---------------------------------------------------------------------------

def professions_match(form_profession: str, detected_text: str) -> bool:
    if not form_profession or not detected_text:
        return False
    f_prof = str(form_profession).lower().strip()
    d_text = str(detected_text).lower().strip()
    if f_prof == d_text:
        return True
    if len(f_prof) >= 4 and re.search(rf'\b{re.escape(f_prof)}', d_text):
        return True
    # Synonym map
    variations = {
        "farmer":    ["farming", "agriculture", "kisan", "agricultural worker", "agriculture worker", "sheti"],
        "business":  ["businessman", "business man", "shopkeeper", "trader", "self employed", "self-employed"],
        "student":   ["education", "studying", "school", "college", "shiksha"],
        "housewife": ["home maker", "homemaker", "grihini", "house wife"],
        "laborer":   ["labour", "mazdoor", "daily wage", "worker"],
    }
    for key, syns in variations.items():
        # If form_profession matches key or any syn
        if f_prof == key or f_prof in syns:
            # Check if d_text matches key or any syn
            if any(s in d_text for s in ([key] + syns)):
                return True
    return False


def names_match(form_name: str, detected_name: str) -> bool:
    if not form_name or not detected_name:
        return False
    form_parts  = set(form_name.lower().split())
    detect_parts = set(detected_name.lower().split())
    return bool(form_parts & detect_parts)


# ---------------------------------------------------------------------------
# GLOBAL MODELS
# ---------------------------------------------------------------------------

try:
    emotion_pipeline = pipeline(
        "text-classification",
        model="j-hartmann/emotion-english-distilroberta-base",
        top_k=1,
    )
    smile_model = opensmile.Smile(
        feature_set=opensmile.FeatureSet.emobase,
        feature_level=opensmile.FeatureLevel.Functionals,
    )
except Exception as e:
    print(f"Model loading failed: {e}")
    emotion_pipeline = None
    smile_model = None


def analyze_sentiment(text: str, audio_path: Optional[str] = None):
    vocal_emotion  = "NEUTRAL"
    speech_meaning = "NEUTRAL"
    primary_label  = "NEUTRAL"

    if emotion_pipeline and text and text.strip():
        try:
            chunk = str(text)[:512]
            res = emotion_pipeline(chunk)
            if res and len(res) > 0:
                primary_label = res[0][0]['label'].upper()
                if primary_label in ["JOY", "SURPRISE"]:
                    speech_meaning = "POSITIVE"
                elif primary_label in ["ANGER", "DISGUST", "FEAR"]:
                    speech_meaning = "NEGATIVE"
        except Exception as e:
            print(f"Text emotion analysis failed: {e}")

    if audio_path and os.path.exists(audio_path) and smile_model:
        try:
            features   = smile_model.process_file(audio_path)
            f0_std     = features['F0_sma_stddev'].values[0]     if 'F0_sma_stddev'      in features.columns else 0
            loudness_std = features['loudness_sma3_stddev'].values[0] if 'loudness_sma3_stddev' in features.columns else 0
            if f0_std > 120 or loudness_std > 1.5:
                vocal_emotion = "ANGRY"
            elif f0_std < 10 and loudness_std < 0.03:
                vocal_emotion = "SAD"
            elif f0_std > 40 and primary_label == "JOY":
                vocal_emotion = "HAPPY"
        except Exception as e:
            print(f"OpenSMILE analysis failed: {e}")

    interpretation = "NEUTRAL CONVERSATION"
    if vocal_emotion == "ANGRY" and speech_meaning == "NEUTRAL":
        interpretation = "FOCUSED OR EMPHATIC TONE"
    elif vocal_emotion == "HAPPY" or speech_meaning == "POSITIVE":
        interpretation = "FRIENDLY ENGAGEMENT"
    elif vocal_emotion == "ANGRY" or speech_meaning == "NEGATIVE":
        interpretation = "POTENTIAL TENSION DETECTED"

    return {
        "emotion": vocal_emotion,
        "meaning": speech_meaning,
        "interpretation": interpretation,
    }


# ---------------------------------------------------------------------------
# TIMESTAMP HELPERS
# ---------------------------------------------------------------------------

def find_question_timestamp(transcript: str, field: str, segments: List[Dict]):
    questions = {
        "name":       [r"what(?:'s| is) your name", r"your name", r"name please",
                       r"apka naam", r"naam bataiye"],
        "age":        [r"what(?:'s| is) your age", r"how old are you", r"your age",
                       r"umr", r"umar", r"kitni umar", r"kitne saal"],
        "profession": [r"what(?:'s| is) your (?:job|profession|work)",
                       r"what do you do", r"kaam kya karte ho", r"vyavasay"],
        "education":  [r"education", r"qualification", r"kahan tak padhe ho",
                       r"shikshan", r"shiksha"],
        "location":   [r"where do you live", r"your (?:address|location|district)",
                       r"kahan rehte hai", r"jilla"],
        "mobile":     [r"mobile", r"number", r"phone", r"nambar", r"mobail"],
    }
    field_patterns = questions.get(field.lower(), [])
    for seg in segments:
        seg_text = seg["text"].lower()
        for pattern in field_patterns:
            if re.search(pattern, seg_text):
                return format_seconds(seg["start"])

    # Keyword fallback
    unique_keywords = {
        "name":       ["name", "naam"],
        "age":        ["age", "old", "umr", "umar"],
        "profession": ["job", "work", "kaam", "nokri"],
        "education":  ["education", "shikshan", "shiksha"],
        "location":   ["live", "address", "kahan", "village"],
        "mobile":     ["mobile", "number", "nambar"],
    }
    keywords = unique_keywords.get(field.lower(), [])
    for seg in segments:
        seg_text = seg["text"].lower()
        if any(kw in seg_text for kw in keywords):
            if any(q in seg_text for q in ["what", "how", "where", "who", "which",
                                            "kahan", "kaun", "?"]):
                return format_seconds(seg["start"])
    return "Not Detected"


# ---------------------------------------------------------------------------
# MAIN AUDIT FUNCTION
# ---------------------------------------------------------------------------

def perform_audit(
    transcript: str,
    form_age: int,
    form_name: str,
    form_profession: str,
    form_education: str,
    form_location: str,
    form_mobile: str,
    segments: List[Dict] = None,
    audio_path: Optional[str] = None,
    llm_data: Optional[Dict[str, Any]] = None,
):
    question_timestamps: Dict[str, str] = {
        k: "Not Detected"
        for k in ["age", "name", "profession", "education", "location", "mobile"]
    }
    is_regex_fallback: Dict[str, bool] = {k: False for k in question_timestamps}

    if segments:
        for field in question_timestamps:
            question_timestamps[field] = find_question_timestamp(transcript, field, segments)

    # ---- Value extraction (LLM preferred, regex fallback) ------------------

    def _get(field, extractor, *args):
        """Return (value, used_regex_fallback)."""
        llm_val = (llm_data or {}).get(field)
        if llm_val:
            return llm_val, False
        val = extractor(*args)
        return val, (val is not None)

    # Filter transcript for Respondent only to avoid catching Surveyor's mobile
    respondent_lines = []
    if transcript:
        for line in transcript.split('\n'):
            if '[Respondent]' in line:
                respondent_lines.append(line.replace('[Respondent]:', '').strip())
    respondent_transcript = " ".join(respondent_lines) if respondent_lines else transcript

    detected_age,       is_regex_fallback["age"]        = _get("age",        extract_age,       transcript)
    detected_name,      is_regex_fallback["name"]       = _get("name",       extract_name,      transcript)
    detected_profession,is_regex_fallback["profession"] = _get("profession", extract_profession, transcript, form_profession)
    detected_education, is_regex_fallback["education"]  = _get("education",  extract_education, transcript)
    detected_location,  is_regex_fallback["location"]   = _get("location",   extract_district,  transcript)
    detected_mobile,    is_regex_fallback["mobile"]     = _get("mobile",     extract_mobile,    respondent_transcript)

    # Age Proximity Rule: If regex fallback used, it MUST be within 2 years of form_age
    if is_regex_fallback["age"] and detected_age is not None:
        try:
            d_age = int(detected_age)
            f_age = int(form_age)
            if abs(d_age - f_age) > 2:
                print(f"DEBUG: Age {d_age} rejected (Regex fallback but > 2 years from {f_age})")
                detected_age = None
                is_regex_fallback["age"] = False
        except:
            detected_age = None
            is_regex_fallback["age"] = False

    # Convert LLM age to int if needed
    if detected_age is not None:
        try:
            detected_age = int(detected_age)
        except (ValueError, TypeError):
            detected_age = None

    sentiment = analyze_sentiment(transcript, audio_path)

    # ---- Status determination ----------------------------------------------

    def normalize_edu(s):
        if not s: return ""
        s = s.lower().strip()
        if "post" in s and "grad" in s: return "postgraduate"
        if "gradu" in s:                return "graduate"
        if "12" in s or "hsc" in s:     return "12th"
        if "10" in s or "ssc" in s:     return "10th"
        return s

    # Age: must be an integer and match exactly
    if detected_age is None:
        age_status = "Inconclusive"
    elif detected_age == int(form_age):
        age_status = "Match"
    else:
        age_status = "Mismatch"

    name_status = (
        "Inconclusive" if not detected_name
        else ("Match" if names_match(form_name, detected_name) else "Mismatch")
    )

    # Profession
    if detected_profession and professions_match(form_profession, detected_profession):
        profession_status = "Match"
    elif detected_profession:
        profession_status = "Mismatch"
    elif professions_match(form_profession, transcript):
        profession_status = "Inconclusive"
    else:
        profession_status = "Mismatch"

    # Education
    if detected_education:
        f_edu = normalize_edu(form_education)
        d_edu = normalize_edu(detected_education)
        education_status = "Match" if (
            f_edu == d_edu or (len(f_edu) > 3 and (f_edu in d_edu or d_edu in f_edu))
        ) else "Mismatch"
    else:
        education_status = "Inconclusive"

    # Location: ≥ 4-char token already guaranteed by extract_district
    if detected_location:
        f_loc = form_location.lower().strip()
        d_loc = detected_location.lower().strip()
        location_status = "Match" if (
            f_loc == d_loc or (len(f_loc) > 3 and (f_loc in d_loc or d_loc in f_loc))
        ) else "Mismatch"
    else:
        location_status = "Inconclusive"

    mobile_status = (
        "Inconclusive" if detected_mobile is None
        else ("Match" if str(form_mobile) in str(detected_mobile) else "Mismatch")
    )

    final_statuses = {
        "age":        age_status,
        "name":       name_status,
        "profession": profession_status,
        "education":  education_status,
        "location":   location_status,
        "mobile":     mobile_status,
    }

    raw_vals = {
        "age": detected_age, "name": detected_name, "profession": detected_profession,
        "education": detected_education, "location": detected_location, "mobile": detected_mobile,
    }

    # If nothing was detected AND no question timestamp found → Inconclusive
    for field in final_statuses:
        if question_timestamps[field] == "Not Detected" and not raw_vals[field]:
            final_statuses[field] = "Inconclusive"

    # ---- Overall status ----------------------------------------------------
    decisive = [s for s in final_statuses.values() if s != "Inconclusive"]
    if not decisive:
        overall_status = "Inconclusive"
    else:
        match_count  = decisive.count("Match")
        overall_status = "Match" if match_count >= len(decisive) / 2 else "Mismatch"

    # ---- Detected-value timestamps -----------------------------------------
    detected_timestamps: Dict[str, Optional[str]] = {k: None for k in raw_vals}

    if segments:
        def find_best_timestamp(val, segs):
            if not val: return None
            val_str    = str(val).lower()
            val_digits = re.sub(r'\D', '', val_str)
            for seg in segs:
                seg_text = seg["text"].lower()
                if val_str in seg_text:
                    return format_seconds(seg["start"])
                if val_digits and len(val_digits) >= 2:
                    seg_digits = re.sub(r'\D', '', seg_text)
                    if val_digits in seg_digits:
                        return format_seconds(seg["start"])
            return None

        for field, val in raw_vals.items():
            detected_timestamps[field] = find_best_timestamp(val, segments)

    return {
        "status":          overall_status,
        "detected_values": raw_vals,
        "statuses":        final_statuses,
        "timestamps": {
            "questions": question_timestamps,
            "detected":  detected_timestamps,
        },
        "sentiment":       sentiment,
        "is_regex_fallback": is_regex_fallback,
    }
