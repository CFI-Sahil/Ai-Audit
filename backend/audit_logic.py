from typing import Optional, List, Dict, Any
import re
import os

def format_seconds(seconds: float) -> str:
    """Convert seconds to M:SS format (e.g. 0:19)."""
    if seconds is None: return "Not Detected"
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m}:{s:02}"

def extract_age(text: str):
    """Extract age from translated English text. Prioritizes age-related phrases."""
    # Pattern 1: Explicit age phrases with high confidence keywords
    # Added "age is", "am [number] years", but excluded just "is [number]" to avoid income matching
    age_patterns = [
        r'(?:my age is|age is|i am|i\'m|am)\s+(\d{1,2})\s*(?:years|year|yrs|yo|old)?',
        r'(\d{1,2})\s*(?:years old|year old|year-old)'
    ]
    for pattern in age_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return int(match.group(1))
    
    # Pattern 2: Look for 'age' followed by a number more loosely
    loose_match = re.search(r'age.*?\b(\d{1,2})\b', text, re.IGNORECASE)
    if loose_match:
        return int(loose_match.group(1))

    # Pattern 3: Standalone numbers (carefully)
    # Only if we see 'years' or 'old' nearby but first patterns missed it
    if re.search(r'\b\d{1,2}\b\s*(?:years|old)', text, re.IGNORECASE):
        numbers = re.findall(r'\b(\d{1,2})\b', text)
        if numbers:
            return int(numbers[0])
            
    return None

def extract_name(text: str):
    """Extract name from translated speech. Handles 'My name is X' or 'This is X'."""
    patterns = [
        r'(?:my name is|name\'s|name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
        r'(?:i am|i\'m|this is|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
        r'(?:my name is|name is)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            # Avoid matching common words that might follow "i am"
            val = match.group(1).strip()
            if val.lower() in ["a", "the", "in", "from", "at", "working"]:
                continue
            return val.title()
    return None

def extract_education(text: str):
    """Extract education level mentioned in transcript."""
    # Keywords
    keywords = [
        r'\bgraduate(?:d|s|ing)?\b', r'\bgraduation\b',
        r'\bpost\s?graduate\b', r'\bpost\s?graduation\b',
        r'\bphd\b', r'\bdoctorate\b',
        r'\bmaster(?:\'s)?\b', r'\bbachelor(?:\'s)?\b', r'\bdiploma\b',
        r'\bmatric\b', r'\bintermediate\b', r'\bdegree\b',
        r'\b10th\b', r'\b12th\b', r'\bprimary\b', r'\bsecondary\b'
    ]
    for pattern in keywords:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(0).strip().lower()
    return None

def extract_district(text: str):
    """Detect district/location mentioned in transcript."""
    # Look for "live in X", "from X", "at X", "district is X"
    # Improved to capture city names more reliably even if the next word is noisy
    patterns = [
        r'(?:live in|lives in|staying in|residing in|from|at|district|location|place)\s+(?:is|my)?\s*([A-Z][a-z]+)',
        r'(?:in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)'
    ]
    for pattern in patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            val = match.group(1).strip()
            # Avoid common words
            if val.lower() in ["a", "the", "my", "your", "his", "her", "very"]:
                continue
            return val.lower()
    return None

def extract_profession(text: str, form_profession: Optional[str] = None):
    """Detect profession keywords in translated text."""
    # 1. Phrases
    patterns = [
        r'(?:my profession is|occupation is|job is|work as a|working as a)\s+([a-zA-Z\s]{2,20}?)(\.|\band\b|\bi\s+earn\b|\bis\b|$)',
        r'(?:i am a|i\'m a|i am an|i\'m an)\s+([a-zA-Z\s]{2,20}?)(\.|\band\b|\bwhat\b|\bi\s+earn\b|$)',
        r'(?:i work in|working in)\s+([a-zA-Z\s]{2,20}?)(\.|\band\b|$)'
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            prof = match.group(1).strip().lower()
            # Clean up trailing noisy Capture Group 2 leftovers if any
            prof = re.split(r'\s+(?:what|is|and|i)\s+', prof)[0]
            return prof

    # 2. Key-match with form
    if form_profession:
        f_prof = str(form_profession).lower().strip()
        if re.search(rf'\b{re.escape(f_prof)}\b', text, re.IGNORECASE):
            return f_prof
            
    return None

def professions_match(form_profession: str, detected_text: str) -> bool:
    """
    Check if form profession and detected text match.
    Allows 'business' (form) to match 'business man' (detected).
    """
    if not form_profession or not detected_text:
        return False
    
    if not form_profession: return False
    f_prof = str(form_profession).lower().strip()
    d_text = str(detected_text).lower().strip()
    
    # 1. Strict equality check
    if f_prof == d_text:
        return True
        
    # 2. Compound Match Logic (e.g., 'business' matches 'business man' or 'businessman')
    # Use word boundaries (\b) to ensure we don't match 'far' with 'farmer'
    # but ALLOW 'business' to match 'business man' or 'sales' to match 'sales worker'
    if len(f_prof) >= 4:
        # Check if the form word appears as a standalone word or at the start of a word in detection
        if re.search(rf'\b{re.escape(f_prof)}', d_text):
            return True
        # Special case for 'businessman' (no space)
        if f_prof == "business" and "businessman" in d_text:
            return True

    # 3. Reverse Check: Transcription says 'broker' and form says 'build broker' (or vice versa)
    # If the form has multiple words, check if any main word matches the detection
    f_parts = [p for p in f_prof.split() if len(p) > 3]
    for part in f_parts:
        if part in d_text:
            return True
            
    # 4. Handle common variations (Keep synonyms check)
    variations = {
        "farmer": ["farming", "agriculture"],
        "business": ["businessman", "business man", "shopkeeper", "trader"],
        "student": ["studying", "college", "school"]
    }
    for key, synonyms in variations.items():
        if f_prof == key or f_prof in synonyms:
            if any(s in d_text for s in [key] + synonyms):
                return True
                
    return False

def names_match(form_name: str, detected_name: str) -> bool:
    """Check if form name and detected name match (case-insensitive, partial ok)."""
    if not form_name or not detected_name:
        return False
    form_parts = set(form_name.lower().split())
    detected_parts = set(detected_name.lower().split())
    # Match if any part of the name overlaps
    return bool(form_parts & detected_parts)

def generic_match(form_val: str, detected_text: str) -> bool:
    """General purpose fuzzy match for labels like district, education, etc."""
    if not form_val or not detected_text:
        return False
    f_val = form_val.lower().strip()
    d_text = detected_text.lower().strip()
    return f_val in d_text or d_text in f_val

def extract_mobile(text: str):
    """Extract 10-digit mobile number from transcript."""
    # Match strings of 10 digits
    match = re.search(r'\b(\d{10})\b', text)
    if match:
        return match.group(1)
    
    # Try to match space-separated or comma-separated numbers
    # e.g. "9 8 7 6 5 4 3 2 1 0" or "98, 76..."
    clean_text = re.sub(r'[^0-9]', '', text)
    # Check if there's a 10-digit sequence anywhere in the digits
    match = re.search(r'(\d{10})', clean_text)
    if match:
        return match.group(1)
    return None

import opensmile
from transformers import pipeline

# Global emotional analysis models
try:
    # Text-based emotion analysis (Meaning)
    emotion_pipeline = pipeline("text-classification", model="j-hartmann/emotion-english-distilroberta-base", top_k=1)
except Exception as e:
    print(f"Emotion model loading failed: {e}")
    emotion_pipeline = None

def analyze_sentiment(text: str, audio_path: Optional[str] = None):
    """
    Advanced sentiment/tone analysis using:
    1. opensmile for Vocal Emotion (Acoustic)
    2. Transformers for Speech Meaning (Semantic)
    """
    vocal_emotion = "NEUTRAL"
    speech_meaning = "NEUTRAL"
    primary_label = "NEUTRAL"
    
    # 1. TEXT BASED EMOTION DETECTION (Speech Meaning)
    if emotion_pipeline and text and text.strip():
        try:
            chunk = str(text)[:512]
            results = emotion_pipeline(chunk)
            if results and len(results) > 0:
                res = results[0]
                if isinstance(res, list): res = res[0]
                label = res.get('label', '').upper()
                if label in ['JOY', 'OPTIMISM', 'SURPRISE']: speech_meaning = "POSITIVE"
                elif label in ['ANGER', 'DISGUST', 'FEAR', 'SADNESS']: speech_meaning = "NEGATIVE"
                else: speech_meaning = "NEUTRAL"
                primary_label = label
        except Exception as e:
            print(f"Text emotion analysis failed: {e}")

    # 2. OPEN SMILE FOR VOICE EMOTION (Acoustic)
    if audio_path and os.path.exists(audio_path):
        try:
            smile = opensmile.Smile(
                feature_set=opensmile.FeatureSet.emobase,
                feature_level=opensmile.FeatureLevel.Functionals,
            )
            features = smile.process_file(audio_path)
            f0_std = features['F0_sma_stddev'].values[0] if 'F0_sma_stddev' in features.columns else 0
            loudness_std = features['loudness_sma3_stddev'].values[0] if 'loudness_sma3_stddev' in features.columns else 0
            
            if f0_std > 50 or loudness_std > 0.5: vocal_emotion = "ANGRY"
            elif f0_std < 20 and loudness_std < 0.1: vocal_emotion = "SAD"
            elif f0_std > 30 and primary_label == "JOY": vocal_emotion = "HAPPY"
            else: vocal_emotion = "NEUTRAL"
        except Exception as e:
            print(f"OpenSMILE analysis failed: {e}")

    # 3. INTERPRETATION LOGIC (Cross-analysis)
    if vocal_emotion == "ANGRY" and speech_meaning == "NEUTRAL":
        interpretation = "AGGRESSIVE TONE BUT NEUTRAL WORDING"
    elif vocal_emotion == "HAPPY" or speech_meaning == "POSITIVE":
        interpretation = "COOPERATIVE AND POSITIVE ENGAGEMENT"
    elif vocal_emotion == "SAD":
        interpretation = "LOW ENERGY OR HESITANT INTERACTION"
    elif vocal_emotion == "ANGRY":
         interpretation = "HIGH NEGATIVITY DETECTED"
    else:
        interpretation = "CALM AND COMPLIANT INTERACTION"
        
    return {
        "emotion": vocal_emotion,
        "meaning": speech_meaning,
        "interpretation": interpretation
    }

def find_question_timestamp(transcript: str, field: str, segments: List[Dict]):
    """Find the timestamp where the surveyor likely asked the question."""
    questions = {
        "name": ["what is your name", "your name", "name please"],
        "age": ["what is your age", "how old are you", "what age"],
        "profession": ["what is your profession", "what do you do", "your work", "occupation"],
        "education": ["what is your education", "how much have you studied", "education level", "qualification"],
        "location": ["where do you live", "where are you from", "your location", "which district", "which city"],
        "mobile": ["mobile number", "contact number", "phone number", "your number"]
    }
    
    field_keywords = questions.get(field.lower(), [])
    for seg in segments:
        seg_text = seg["text"].lower()
        if any(kw in seg_text for kw in field_keywords):
            return format_seconds(seg["start"])
    return "Not Detected"

def perform_audit(
    transcript: str, 
    form_age: int, 
    form_name: str, 
    form_profession: str,
    form_education: str,
    form_location: str,
    form_mobile: str,
    segments: Optional[List[Dict[str, Any]]] = None,
    audio_path: Optional[str] = None
):
    detected_age = extract_age(transcript)
    detected_name = extract_name(transcript)
    detected_profession = extract_profession(transcript, form_profession)
    detected_education = extract_education(transcript)
    detected_location = extract_district(transcript) # Using district logic for location
    detected_mobile = extract_mobile(transcript)
    
    # Sentiment
    sentiment = analyze_sentiment(transcript, audio_path)
    
    # Status Checks
    age_status = "Match" if detected_age == int(form_age) else ("Inconclusive" if detected_age is None else "Mismatch")
    name_status = "Match" if (detected_name and names_match(form_name, detected_name)) else ("Inconclusive" if detected_name is None else "Mismatch")
    profession_status = "Match" if professions_match(form_profession, transcript) else "Mismatch"
    
    # Mobile check
    mobile_status = "Match" if (detected_mobile and str(form_mobile) in str(detected_mobile)) else ("Inconclusive" if detected_mobile is None else "Mismatch")

    # Education normalization
    def normalize_edu(s):
        if not s: return ""
        s = s.lower().strip()
        s = s.replace("-", " ").replace("&", " ")
        s = s.replace("tion", "").replace("ion", "").replace("ing", "")
        s = re.sub(r'(\d+)(?:th|st|nd|rd)', r'\1', s)
        s = s.replace("grade", "").replace("class", "").replace("standard", "").strip()
        return re.sub(r'\s+', ' ', s)

    education_status = "Mismatch"
    if detected_education:
        f_edu = normalize_edu(form_education)
        d_edu = normalize_edu(detected_education)
        if f_edu == d_edu or (len(f_edu) > 3 and (f_edu in d_edu or d_edu in f_edu)):
            education_status = "Match"

    # Location check
    location_status = "Mismatch"
    if detected_location:
        f_loc = form_location.lower().strip()
        d_loc = detected_location.lower().strip()
        if f_loc == d_loc or (len(f_loc) > 3 and (f_loc in d_loc or d_loc in f_loc)):
            location_status = "Match"

    # Timestamps
    detected_timestamps: Dict[str, Optional[str]] = {
        "age": None, "name": None, "profession": None, "education": None, "location": None, "mobile": None
    }
    question_timestamps: Dict[str, str] = {
        "age": "Not Detected", "name": "Not Detected", "profession": "Not Detected", 
        "education": "Not Detected", "location": "Not Detected", "mobile": "Not Detected"
    }

    if segments:
        def find_best_timestamp(target_val: Optional[object], segments: List[Dict]):
            if target_val is None: return None
            target_val = str(target_val).lower().strip()
            target_parts = [p.strip() for p in re.split(r'[\s\-]', target_val) if len(p) > 1]
            for seg in segments:
                words = seg.get("words", [])
                if words:
                    for w in words:
                        w_text = w["word"].lower().strip().strip(".,?!")
                        if w_text == target_val or (target_parts and w_text in target_parts):
                            return format_seconds(w["start"])
                if target_val in seg["text"].lower():
                    return format_seconds(seg["start"])
            return None

        detected_timestamps["age"] = find_best_timestamp(detected_age, segments)
        detected_timestamps["name"] = find_best_timestamp(detected_name, segments)
        detected_timestamps["profession"] = find_best_timestamp(detected_profession, segments)
        detected_timestamps["education"] = find_best_timestamp(detected_education, segments)
        detected_timestamps["location"] = find_best_timestamp(detected_location, segments)
        detected_timestamps["mobile"] = find_best_timestamp(detected_mobile, segments)
        
        # Question Asked Timestamps
        for field in question_timestamps.keys():
            question_timestamps[field] = find_question_timestamp(transcript, field, segments)

    # Dynamic status calculation with Inconclusive fallback
    final_statuses = {
        "age": age_status,
        "name": name_status,
        "profession": profession_status,
        "education": education_status,
        "location": location_status,
        "mobile": mobile_status
    }
    
    # Raw values for empty checking
    raw_vals = {
        "age": detected_age, "name": detected_name, "profession": detected_profession,
        "education": detected_education, "location": detected_location, "mobile": detected_mobile
    }

    for field in final_statuses.keys():
        # If question not detected AND AI found nothing
        if question_timestamps[field] == "Not Detected" and not raw_vals[field]:
            final_statuses[field] = "Inconclusive"

    # Overall Audit Status Logic
    # Filter out inconclusive results for the overall verdict
    decisive_statuses = [s for s in final_statuses.values() if s != "Inconclusive"]
    if not decisive_statuses:
        overall_status = "Inconclusive"
    elif all(s == "Match" for s in decisive_statuses):
        overall_status = "Match"
    else:
        overall_status = "Mismatch"

    return {
        "status": overall_status,
        "detected_values": {
            "age": detected_age,
            "name": str(detected_name).title() if detected_name else "None",
            "profession": str(detected_profession).title() if detected_profession else "None",
            "education": str(detected_education).title() if detected_education else "None",
            "location": str(detected_location).title() if detected_location else "None",
            "mobile": detected_mobile if detected_mobile else "None"
        },
        "statuses": final_statuses,
        "timestamps": {
            "detected": detected_timestamps,
            "questions": question_timestamps
        },
        "sentiment": sentiment,
        "message": f"Overall Audit: {overall_status}"
    }
