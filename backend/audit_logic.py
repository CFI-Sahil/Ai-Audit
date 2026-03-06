import re

def extract_age(text: str):
    """Extract age from spoken text."""
    match = re.search(r'(?:age is|I am|I\'m|am|years old)\s*(\d+)', text, re.IGNORECASE)
    if match:
        return int(match.group(1))
    numbers = re.findall(r'\b(\d+)\b', text)
    if numbers:
        return int(numbers[0])
    return None

def extract_name(text: str):
    """Extract name from spoken text using common patterns."""
    patterns = [
        r'(?:my name is|I am|I\'m|name\'s|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
        r'(?:my name is|I am|I\'m|name\'s|this is)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip().title()
    return None

def names_match(form_name: str, detected_name: str) -> bool:
    """Check if form name and detected name match (case-insensitive, partial ok)."""
    if not form_name or not detected_name:
        return False
    form_parts = set(form_name.lower().split())
    detected_parts = set(detected_name.lower().split())
    # Match if any part of the name overlaps
    return bool(form_parts & detected_parts)

def perform_audit(transcript: str, form_age: int, form_name: str):
    detected_age = extract_age(transcript)
    detected_name = extract_name(transcript)

    # Age check
    if detected_age is None:
        age_status = "Inconclusive"
    elif detected_age == int(form_age):
        age_status = "Match"
    else:
        age_status = "Mismatch"

    # Name check
    if detected_name is None:
        name_status = "Inconclusive"
    elif names_match(form_name, detected_name):
        name_status = "Match"
    else:
        name_status = "Mismatch"

    # Overall status: Match only if both match
    if age_status == "Match" and name_status == "Match":
        overall_status = "Match"
    elif age_status == "Inconclusive" or name_status == "Inconclusive":
        overall_status = "Inconclusive"
    else:
        overall_status = "Mismatch"

    return {
        "status": overall_status,
        "detected_age": detected_age,
        "detected_name": detected_name,
        "age_status": age_status,
        "name_status": name_status,
        "message": f"Age: {age_status} | Name: {name_status}"
    }
