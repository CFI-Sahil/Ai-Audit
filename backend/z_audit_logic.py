from typing import List, Dict, Any, Optional
import json
import re

def perform_z_audit(
    uid: str,
    transcript: str,
    audioanswers: Optional[List[List[str]]] = None,
    registration_details: Optional[List[List[str]]] = None,
    llm_analysis: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Perform a fully automated audit for Z-AUDIT platform with 10-point scoring.
    
    Rules:
    - Fake Form -> score = 0
    - Mimicry -> -8
    - Force Survey -> -6
    - Multiple Respondents -> -5
    - Data Mismatch -> -4
    """
    score = 10
    issues = []
    evidence = []
    
    # Check for Fake Form (Score = 0)
    # If transcript is too short or if LLM flagged it
    is_fake = False
    if not transcript or len(transcript.strip().split()) < 5:
        is_fake = True
        evidence.append("Transcript contains less than 5 words; likely silent or noise only.")
    
    if llm_analysis and llm_analysis.get("is_fake_form"):
        is_fake = True
        evidence.append(llm_analysis.get("fake_form_reason", "AI detected meaningless or noise-only audio."))

    if is_fake:
        score = 0
        issues.append("Fake Form")
    else:
        # Check Mimicry (-8)
        if llm_analysis and llm_analysis.get("is_mimicry"):
            score -= 8
            issues.append("Mimicry")
            evidence.append(llm_analysis.get("mimicry_reason", "AI detected surveyor answering on behalf of respondent."))

        # Check Force Survey (-6)
        # Form answers not present in transcript
        force_survey_found = False
        missing_answers = []
        if audioanswers and transcript:
            for entry in audioanswers:
                if isinstance(entry, list) and len(entry) >= 2 and entry[0]:
                    ans = str(entry[0]).lower().strip()
                    if len(ans) > 2 and ans not in ["yes", "no", "ok"]:
                        if ans not in transcript.lower():
                            missing_answers.append(ans)
        
        if missing_answers:
            force_survey_found = True
            # Use a safe slice or loop to avoid lint errors
            max_ev = min(3, len(missing_answers))
            for i in range(max_ev):
                ma = missing_answers[i]
                evidence.append(f"Answer '{ma}' present in form but not found in transcript")
        
        if llm_analysis and llm_analysis.get("is_force_survey"):
            force_survey_found = True
            evidence.append(llm_analysis.get("force_survey_reason", "AI detected answers in form that were not discussed."))

        if force_survey_found:
            score -= 6
            issues.append("Force Survey")

        # Check Multiple Respondents (-5)
        if llm_analysis and llm_analysis.get("is_multiple_respondents"):
            score -= 5
            issues.append("Multiple Respondents")
            evidence.append(llm_analysis.get("multiple_respondents_reason", "AI detected multiple distinct speakers answering questions."))

        mismatch_found = False
        if registration_details and transcript:
            for entry in registration_details:
                if isinstance(entry, list) and len(entry) >= 2 and entry[0]:
                    val = str(entry[0]).lower().strip()
                    label = str(entry[1]).upper().strip()
                    if label in ["GENDER", "OCCUPATION", "AGE"]:
                        if val not in transcript.lower() and len(val) > 2:
                            # Fuzzy check or LLM check preferred here
                            pass

        if llm_analysis and llm_analysis.get("is_data_mismatch"):
            mismatch_found = True
            evidence.append(llm_analysis.get("data_mismatch_reason", "AI detected contradictions between transcript and registration details."))

        if mismatch_found:
            score -= 4
            issues.append("Data Mismatch")

    # Final Score Clamp
    score = max(0, min(10, score))
    
    # Payment Decision
    payment = "No Payment"
    if score >= 8:
        payment = "Full Payment"
    elif score >= 5:
        payment = "Partial Payment"
        
    # Status
    status = "Clean" if not issues else "Flagged"
    if score == 0: status = "Rejected"
    
    return {
        "uid": uid,
        "status": status,
        "score": score,
        "payment": payment,
        "issues": issues,
        "confidence": 0.95 if score >= 8 or score == 0 else 0.8,
        "reason": "Audit completed based on transcript analysis and data comparison." if not issues else f"Issues detected: {', '.join(issues)}",
        "evidence": evidence
    }
