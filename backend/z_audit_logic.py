from typing import List, Dict, Any, Optional
import json
import re

def perform_z_audit(
    uid: str,
    transcript: str,
    audioanswers: Optional[List[List[str]]] = None,
    registration_details: Optional[List[List[str]]] = None,
    llm_analysis: Optional[Dict[str, Any]] = None,
    sentiment: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Perform a fully automated audit for Z-AUDIT platform with 10-point scoring.
    """
    score = 10
    issues = []
    
    # Fake Form (Score = 0)
    is_fake = False
    fake_ev = []
    if not transcript or len(transcript.strip().split()) < 5:
        is_fake = True
        fake_ev.append("Transcript contains less than 5 words; likely silent or noise only.")
    
    if llm_analysis and llm_analysis.get("is_fake_form"):
        is_fake = True
        fake_ev.append(llm_analysis.get("fake_form_reason", "AI detected meaningless or noise-only audio."))

    if is_fake:
        return {
            "uid": uid, "status": "Rejected", "score": 0, "payment": "No Payment",
            "issues": ["Fake Form"], "confidence": 0.95,
            "reason": f"Audit rejected: {fake_ev[0] if fake_ev else 'Fake Form'}",
            "evidence": fake_ev
        }

    raw_evidence = []
    active_issues = set()
    
    if llm_analysis:
        if llm_analysis.get("is_mimicry"): active_issues.add("Mimicry")
        if llm_analysis.get("is_force_survey"): active_issues.add("Force Survey")
        if llm_analysis.get("is_multiple_respondents"): active_issues.add("Multiple Respondents")
        if llm_analysis.get("is_data_mismatch"): active_issues.add("Data Mismatch")

    # Deduct scores
    if "Mimicry" in active_issues: score -= 8
    if "Force Survey" in active_issues: score -= 6
    if "Multiple Respondents" in active_issues: score -= 5
    if "Data Mismatch" in active_issues: score -= 4
    
    score = max(0, min(10, score))
    payment = "No Payment"
    if score >= 8: payment = "Full Payment"
    elif score >= 5: payment = "Partial Payment"
        
    status = "Clean" if not active_issues else "Flagged"
    
    return {
        "uid": uid,
        "status": status,
        "score": score,
        "payment": payment,
        "issues": sorted(list(active_issues)),
        "confidence": 0.8,
        "reason": "Audit completed.",
        "evidence": [item.get("detail", "") for item in llm_analysis.get("evidence", [])] if llm_analysis and "evidence" in llm_analysis else []
    }
