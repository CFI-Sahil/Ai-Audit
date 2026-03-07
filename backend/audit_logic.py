from typing import Optional, List, Dict, Any
import re

def format_seconds(seconds: float) -> str:
    """Convert seconds to H:M:S format."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    return f"{h}:{m:02}:{s:02}"

def extract_age(text: str):
    """Extract age from translated English text. Prioritizes age-related phrases."""
    # Pattern 1: Explicit age phrases
    age_patterns = [
        r'(?:my age is|i am|i\'m|am|aged|is)\s+(\d+)\s*(?:years|year|yrs|yo)?',
        r'(\d+)\s*(?:years old|year old|year-old)'
    ]
    for pattern in age_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return int(match.group(1))
    
    # Pattern 2: Standalone numbers (only if no age phrase found)
    # Filter out common high numbers like 10,000 or years like 2024
    numbers = re.findall(r'\b(\d{1,2})\b', text) # Only 1-2 digit numbers likely to be age
    if numbers:
        return int(numbers[0])
    return None

def extract_name(text: str):
    """Extract name from translated speech. Handles 'My name is X' or 'This is X'."""
    patterns = [
        r'(?:my name is|i am|i\'m|name\'s|this is|call me|name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
        r'(?:my name is|i am|i\'m|name\'s|this is|name is)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip().title()
    return None

def extract_education(text: str):
    """Extract education level mentioned in transcript (e.g., 10th, Graduate, Bachelor)."""
    # 1. Look for grade/class patterns: "studied till 10th", "12th grade", "10th class"
    grade_match = re.search(r'(?:studied|study|education|level|class|grade|standard|till|up to|passed|did)\s+(?:is|in|of|my)?\s*(\b\d{1,2}(?:th|st|nd|rd)?\b(?:\s+(?:grade|class|standard))?)', text, re.IGNORECASE)
    if grade_match:
        return grade_match.group(1).strip().lower()

    # 2. Look for keywords anywhere in the text
    keywords = [
        r'\bgraduate(?:d|s|ing)?\b', r'\bgraduation\b',
        r'\bpost\s?graduate\b', r'\bpost\s?graduation\b',
        r'\bphd\b', r'\bdoctorate\b',
        r'\bmaster(?:\'s)?\b', r'\bbachelor(?:\'s)?\b', r'\bdiploma\b',
        r'\bmatric\b', r'\bintermediate\b', r'\bdegree\b', r'\bschooling\b',
        r'\bb\.?sc\b', r'\bb\.?a\b', r'\bm\.?a\b', r'\bm\.?sc\b', r'\bb\.?tech\b',
        r'\bprimary\b', r'\bsecondary\b', r'\bliterate\b', r'\billiterate\b'
    ]
    for pattern in keywords:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(0).strip().lower()
    return None

def extract_district(text: str):
    """Detect district/location mentioned in transcript."""
    # Look for "live in X", "from X", "at X", "district is X"
    patterns = [
        r'(?:district|location|city|village|area|staying in|from|at|live in|lives in|reside in|place)\s+(?:is|my)?\s*([A-Z][a-z]+)',
        r'\bin\s+([A-Z][a-z]+)\b'
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip().lower()
    return None

def extract_profession(text: str, form_profession: Optional[str] = None):
    """Detect profession keywords in translated text."""
    # 1. Look for common profession intros, stop at period or 'and' or 'i earn'
    # Added optional 'i' for 'work as a'
    patterns = [
        r'(?:i\s+am\s+a|i\s+work\s+as\s+a|work\s+as\s+a|i\'m\s+a|profession\s+is|occupation\s+is|job\s+is|worker\s+is|do)\s+([a-zA-Z\s]{2,25}?)(?:\.|\band\b|\bi\s+earn\b|$)',
        r'(?:i\s+am\s+in|i\s+work\s+in|work\s+in)\s+([a-zA-Z\s]{2,20}?)(?:\.|\band\b|$)'
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip().lower()

    # 2. Fallback: If not found via phrases, use the Survey Form value as a hint
    if form_profession:
        # Use str() to satisfy linter that it's not None
        f_prof = str(form_profession).lower().strip()
        # Look for the form word specifically in the transcript
        if re.search(rf'\b{re.escape(f_prof)}\b', text, re.IGNORECASE):
            # Try to grab a small snippet around it for 'detected' value
            snippet_match = re.search(rf'([^.]{{0,15}}\b{re.escape(f_prof)}\b[^.]{{0,15}})', text, re.IGNORECASE)
            if snippet_match:
                return snippet_match.group(1).strip().lower()
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

def perform_audit(
    transcript: str, 
    form_age: int, 
    form_name: str, 
    form_profession: str,
    form_education: str,
    form_district: str,
    segments: Optional[List[Dict[str, Any]]] = None
):
    detected_age = extract_age(transcript)
    detected_name = extract_name(transcript)
    detected_profession = extract_profession(transcript, form_profession)
    detected_education = extract_education(transcript)
    detected_district = extract_district(transcript)
    
    # Check logic
    age_status = "Match" if detected_age == int(form_age) else ("Inconclusive" if detected_age is None else "Mismatch")
    name_status = "Match" if (detected_name and names_match(form_name, detected_name)) else ("Inconclusive" if detected_name is None else "Mismatch")
    profession_status = "Match" if professions_match(form_profession, transcript) else "Mismatch"
    
    # Better Education match logic (handle 10th vs 10th, grade vs no grade)
    education_status = "Inconclusive"
    if detected_education:
        # Normalize: replace "10th", "12th" with "10", "12" for comparison
        # Normalize: replace suffixes and special characters
        def normalize_edu(s):
            if not s: return ""
            s = s.lower().strip()
            # Remove special characters like - and &
            s = s.replace("-", " ").replace("&", " ")
            # Remove common suffixes: tion, ion, ing
            s = s.replace("tion", "").replace("ion", "").replace("ing", "")
            # Remove suffixes from numbers: 10th -> 10, 12th -> 12
            s = re.sub(r'(\d+)(?:th|st|nd|rd)', r'\1', s)
            # Remove noisy words
            s = s.replace("grade", "").replace("class", "").replace("standard", "").strip()
            # Normalize multiple spaces
            s = re.sub(r'\s+', ' ', s)
            return s

        form_edu_norm = normalize_edu(form_education)
        detected_edu_norm = normalize_edu(detected_education)
        
        # Strict equality for education (prevents "1" matching "10")
        if form_edu_norm == detected_edu_norm:
            education_status = "Match"
        # Only allow "in" if the string is long enough to be a degree name
        elif len(form_edu_norm) > 3 and (form_edu_norm in detected_edu_norm or detected_edu_norm in form_edu_norm):
            education_status = "Match"
        else:
            education_status = "Mismatch"
    else:
        education_status = "Mismatch" # Changed from Inconclusive per request
            
    # Better District match logic
    district_status = "Inconclusive"
    if detected_district:
        form_dist = form_district.lower().strip()
        det_dist = detected_district.lower().strip()
        # Strict equality or robust word match (length > 3)
        if form_dist == det_dist:
            district_status = "Match"
        elif len(form_dist) > 3 and (form_dist in det_dist or det_dist in form_dist):
            district_status = "Match"
        else:
            district_status = "Mismatch"
    else:
        district_status = "Mismatch" # Changed from Inconclusive per request

    # -- TIMESTAMP DETECTION --
    timestamps: Dict[str, Optional[str]] = {
        "age": None,
        "name": None,
        "profession": None,
        "education": None,
        "district": None
    }

    if segments:
        print(f"DEBUG: Pinpointing word-level timestamps...")
        
        def find_best_timestamp(target_val: Optional[object], segments: List[Dict]):
            if target_val is None: return None
            target_val = str(target_val).lower().strip()
            target_parts = [p.strip() for p in re.split(r'[\s\-]', target_val) if len(p) > 1]
            
            # Check every word in every segment for the highest precision
            for seg in segments:
                words = seg.get("words", [])
                if words:
                    for w in words:
                        w_text = w["word"].lower().strip().strip(".,?!")
                        if w_text == target_val or (target_parts and w_text in target_parts):
                            return format_seconds(w["start"])
                
                # Fallback to segment level if word level mismatch
                seg_text = seg["text"].lower()
                if target_val in seg_text or (target_parts and any(p in seg_text for p in target_parts)):
                    return format_seconds(seg["start"])
            return None

        timestamps["age"] = find_best_timestamp(detected_age, segments)
        timestamps["name"] = find_best_timestamp(detected_name, segments)
        timestamps["profession"] = find_best_timestamp(detected_profession, segments)
        timestamps["education"] = find_best_timestamp(detected_education, segments)
        timestamps["district"] = find_best_timestamp(detected_district, segments)

        print(f"DEBUG: Precise Timestamps found: {timestamps}")

    # Overall status: only count fields that aren't gender
    checks = {
        "Age": age_status, 
        "Name": name_status, 
        "Profession": profession_status,
        "Education": education_status,
        "District": district_status
    }

    if all(s == "Match" for s in checks.values()):
        overall_status = "Match"
    elif any(s == "Mismatch" for s in checks.values()):
        overall_status = "Mismatch"
    else:
        overall_status = "Mismatch"

    detailed_msg = " | ".join([f"{k}: {v}" for k, v in checks.items()])

    return {
        "status": overall_status,
        "detected_age": detected_age,
        "detected_name": detected_name,
        "detected_profession": detected_profession.title() if detected_profession else "None",
        "detected_education": detected_education.title() if detected_education else "None",
        "detected_district": detected_district.title() if detected_district else "None",
        "age_status": age_status,
        "name_status": name_status,
        "profession_status": profession_status,
        "education_status": education_status,
        "district_status": district_status,
        "timestamps": timestamps,
        "message": detailed_msg
    }
