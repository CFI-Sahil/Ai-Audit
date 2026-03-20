import asyncio
import os
import sys
import json
import pandas as pd
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
        return {"error": f"Failed to load data for UID {uid}: {str(e)}"}

    # Step 2: Process Audio
    # Find the main audio file in audiourls (usually the one with 'USER' or ending in .wav)
    audio_rel_path = None
    if audio_urls and isinstance(audio_urls, list):
        for entry in audio_urls:
            if isinstance(entry, list) and len(entry) >= 2:
                path = entry[1]
                if path.endswith(".wav") or path.endswith(".mp3"):
                    audio_rel_path = path
                    break
    
    if not audio_rel_path:
        return {"error": "No audio URL found in survey data."}
    
    # Path is relative: /media/registration/111379_registration.wav
    # We resolve it relative to media_base_path or look in the flat directory
    filename = os.path.basename(audio_rel_path)
    audio_full_path = os.path.join(media_base_path, audio_rel_path.lstrip("/"))
    
    if not os.path.exists(audio_full_path):
        # Fallback: Look directly in media_base_path for the filename
        alt_path = os.path.join(media_base_path, filename)
        if os.path.exists(alt_path):
            audio_full_path = alt_path
        else:
            # Another fallback: Look in ..\MH Project 17-03-26\ which we found earlier
            mh_path = os.path.join("..", "..", "MH Project 17-03-26", filename)
            if os.path.exists(mh_path):
                audio_full_path = mh_path
            else:
                return {"error": f"Audio file {filename} not found in {media_base_path} or fallbacks."}

    # Transcribe and Analyze
    try:
        print(f"DEBUG: Transcribing {audio_full_path} with timestamps...")
        transcription_result = await whisper_service.transcribe(audio_full_path)
        transcript = transcription_result.get("text", "")
        segments = transcription_result.get("segments", [])
        
        # Parse reg details to standard fields
        form_age = 0
        form_name = "N/A"
        form_profession = "N/A"
        form_education = "N/A"
        form_location = "N/A"
        form_mobile = "N/A"

        for entry in reg_details:
            if isinstance(entry, list) and len(entry) >= 2 and entry[0]:
                val = str(entry[0]).strip()
                label = str(entry[1]).strip().upper()
                if label == "FR NAME": form_name = val
                elif label == "MOBILE NUMBER": form_mobile = val
                elif label == "DOB":
                    try:
                        form_age = 2026 - int(val.split('-')[0])
                    except: pass
                elif label == "AREA": form_location = val
                elif label == "OCCUPATION": form_profession = val

        print(f"DEBUG: Extracting structured LLM info for standard audit...")
        llm_data = None
        try:
            llm_data = await whisper_service.extract_structured_info(transcript)
        except Exception as e:
            print(f"Standard LLM extraction failed: {e}")

        print(f"DEBUG: Running Standard Audit logic...")
        standard_audit = perform_audit(
            transcript=transcript,
            form_age=int(form_age) if form_age else 0,
            form_name=form_name,
            form_profession=form_profession,
            form_education=form_education,
            form_location=form_location,
            form_mobile=form_mobile,
            segments=segments,
            audio_path=audio_full_path,
            llm_data=llm_data
        )

        # Run Z-Audit specific scanner
        print(f"DEBUG: Running Z-Audit Issue Scanner...")
        llm_analysis = await whisper_service.analyze_z_audit_issues(transcript, reg_details)
        
        # Step 3 & 4: Compare and Detect
        z_audit_result = perform_z_audit(
            uid=uid,
            transcript=transcript,
            audioanswers=audio_answers,
            registration_details=reg_details,
            llm_analysis=llm_analysis
        )
        
        standard_audit["z_audit"] = z_audit_result
        standard_audit["transcript"] = transcript
        standard_audit["audio_path"] = audio_full_path
        return standard_audit

    except Exception as e:
        return {"error": f"Pipeline failure: {str(e)}"}

async def main():
    parser = argparse.ArgumentParser(description="Z-AUDIT Automated Engine")
    parser.add_argument("--uid", type=str, required=True, help="UID of the survey to audit")
    parser.add_argument("--media", type=str, default="..", help="Base path for media files (default: project root)")
    args = parser.parse_args()
    
    result = await run_automated_audit(args.uid, args.media)
    print("\n---------------- AUDIT RESULT (JSON) ----------------")
    print(json.dumps(result, indent=2))
    print("-----------------------------------------------------")

if __name__ == "__main__":
    asyncio.run(main())
