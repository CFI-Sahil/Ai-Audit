import asyncio
import os
import sys
import json
import pandas as pd
import re
from pathlib import Path
import argparse

# Add current directory to path for imports
sys.path.append(os.getcwd())

from whisper_service import whisper_service
from z_audit_logic import perform_z_audit
from audit_logic import perform_audit

async def run_automated_audit(uid: str, media_base_path: str = ".."):
    """
    Step 1: Load Data
    Step 2: Process Audio
    Step 3: Compare Data
    Step 4: Detect Issues
    """
    print(f"--- Z-AUDIT Automated Engine Initialized for UID: {uid} ---")
    
    # Step 1: Load Data from Excel
    excel_path = "../data_with_json.xlsx"
    if not os.path.exists(excel_path):
        return {"error": f"Excel file not found at {excel_path}"}
    
    try:
        df = pd.read_excel(excel_path, header=None)
        # Column 1 is UID, Column 2 is JSON string
        # Search for UID (handling potential float/string mismatch)
        row = None
        for i in range(len(df)):
            cell_uid = str(df.iloc[i, 1]).split('.')[0] # handle 1111.0
            if cell_uid == str(uid):
                row = df.iloc[i]
                break
        
        if row is None:
            return {"error": f"UID {uid} not found in data source."}
        
        data = json.loads(row[2])
        audio_answers = data.get("audioanswers", [])
        reg_details = data.get("registration_details", [])
        actual_address = data.get("actualaddress", "")
        audio_urls = data.get("audiourls", [])
        
    except Exception as e:
        print(f"Error loading UID data: {e}")
        return {"error": str(e)}

    # Step 2: Resolve Audio Files
    audio_rel_path = data.get("audiourl")
    
    if not audio_rel_path:
        # Fallback: Look inside registration_details for anything ending in .wav or .mp3
        for entry in reg_details:
            if isinstance(entry, list) and len(entry) >= 1:
                val = str(entry[0]).strip()
                if val.lower().endswith((".wav", ".mp3")):
                    audio_rel_path = val
                    print(f"DEBUG: Found audio path in registration_details: {audio_rel_path}")
                    break
    
    if not audio_rel_path:
        # Second Fallback: Check audiourls list (often list of lists [['label', 'path'], ...])
        if audio_urls and isinstance(audio_urls, list) and len(audio_urls) > 0:
            for item in audio_urls:
                if isinstance(item, list):
                    for subitem in item:
                        s_subitem = str(subitem).strip()
                        if s_subitem.lower().endswith((".wav", ".mp3")):
                            audio_rel_path = s_subitem
                            print(f"DEBUG: Found audio path in audiourls list: {audio_rel_path}")
                            break
                elif isinstance(item, str) and item.lower().endswith((".wav", ".mp3")):
                    audio_rel_path = item.strip()
                    break
                if audio_rel_path: break

    if not audio_rel_path or not isinstance(audio_rel_path, str):
        return {"error": "No audio URL found in survey data."}
    
    # Path is relative: /media/registration/111379_registration.wav
    filename = os.path.basename(audio_rel_path)
    audio_full_path = os.path.join(media_base_path, audio_rel_path.lstrip("/"))
    
    if not os.path.exists(audio_full_path):
        alt_path = os.path.join(media_base_path, filename)
        if os.path.exists(alt_path):
            audio_full_path = alt_path
        else:
            mh_path = os.path.join("..", "..", "MH Project 17-03-26", filename)
            if os.path.exists(mh_path):
                audio_full_path = mh_path
            else:
                return {"error": f"Audio file not found: {filename}"}

    # Step 3: Transcription
    try:
        transcription_result = await whisper_service.transcribe(audio_full_path)
        transcript = transcription_result["text"]
        segments = transcription_result["segments"]
    except Exception as e:
        print(f"Transcription failed: {e}")
        return {"error": f"Transcription failed: {e}"}

    # Extract Registration Data for Standard Audit
    form_age = 0
    form_name = ""
    form_mobile = ""
    form_location = ""
    form_profession = ""
    
    for entry in reg_details:
        if isinstance(entry, list) and len(entry) >= 2:
            # Handle both [Value, Label] and [Instruction, Value, Label]
            if len(entry) >= 3:
                val = str(entry[1]).strip()
                label = str(entry[2]).strip().upper()
            else:
                val = str(entry[0]).strip()
                label = str(entry[1]).strip().upper()

            if label in ["FR NAME", "NAME", "NAME OF THE RESPONDENT", "FULL NAME", "RESPONDENT NAME"]:
                form_name = val
            elif label in ["MOBILE NUMBER", "MOBILE", "PHONE"]:
                form_mobile = val
            elif label in ["DOB", "DATE OF BIRTH"]:
                try: 
                    year = int(re.search(r'\d{4}', val).group(0))
                    form_age = 2026 - year
                except: pass
            elif label in ["AREA", "LOCATION", "VILLAGE", "DISTRICT"]:
                form_location = val
            elif label in ["OCCUPATION", "PROFESSION", "WORK"]:
                form_profession = val
    
    # Ensure name is not "Surveyor"
    if form_name and "surveyor" in form_name.lower():
        form_name = ""

    print(f"DEBUG: Extracting structured LLM info for standard audit...")
    llm_data = None
    try:
        llm_data = await whisper_service.extract_structured_info(transcript)
    except Exception as e:
        print(f"Standard LLM extraction failed: {e}")

    print(f"DEBUG: Running Standard Audit logic...")
    standard_audit = perform_audit(
        transcript=transcript,
        form_age=form_age,
        form_name=form_name,
        form_profession=form_profession,
        form_education="Not Provided", # Default
        form_location=form_location,
        form_mobile=form_mobile,
        segments=segments,
        audio_path=audio_full_path,
        llm_data=llm_data
    )

    # Run Z-Audit specific scanner
    print(f"DEBUG: Running Z-Audit Issue Scanner (Gemini)...")
    llm_analysis = await whisper_service.analyze_z_audit_issues(
        transcript, 
        reg_details, 
        standard_audit=standard_audit
    )
    
    # Step 4: Final Compilation
    # The new Gemini-based analyze_z_audit_issues provides the full score and decision
    z_audit_result = {
        "uid": uid,
        "final_score": llm_analysis.get("final_score", 0),
        "payment_decision": llm_analysis.get("payment_decision", "No Payment"),
        "issues_detected": llm_analysis.get("issues_detected", []),
        "audit_summary": llm_analysis.get("audit_summary", ""),
        "evidence": llm_analysis.get("evidence", []),
        "sentiment": standard_audit.get("sentiment"),
        "status": "Clean" if llm_analysis.get("final_score", 0) >= 8 else "Flagged"
    }
    
    standard_audit["z_audit"] = z_audit_result
    standard_audit["transcript"] = transcript
    standard_audit["audio_path"] = audio_full_path
    
    print(f"--- Z-AUDIT Automated Engine Finish ---")
    return standard_audit

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Z-Audit Automated Engine")
    parser.add_argument("uid", type=str, help="Survey UID")
    args = parser.parse_args()
    
    asyncio.run(run_automated_audit(args.uid))
    parser.add_argument("uid", type=str, help="Survey UID")
    args = parser.parse_args()
    
    asyncio.run(run_automated_audit(args.uid))
