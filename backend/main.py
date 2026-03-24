from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import shutil
import os
import uuid
import json
import pandas as pd
from pydantic import BaseModel

from database import SessionLocal, Survey
from whisper_service import whisper_service
import re
from audit_logic import perform_audit
from z_audit_engine import run_automated_audit
from surveyor_logic import calculate_surveyor_payroll
from dotenv import load_dotenv

load_dotenv()
BASE_URL = os.getenv("BASE_URL", "http://localhost:8005")

# Persistent Logging
import logging
logging.basicConfig(
    filename='backend_debug.log',
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
logger.info("Backend starting...")

app = FastAPI()

# Create directories
os.makedirs("saved_audio", exist_ok=True)
os.makedirs("temp_audio", exist_ok=True)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for audio
app.mount("/audio", StaticFiles(directory="saved_audio"), name="audio")

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/upload-survey")
async def upload_survey(
    name: str = Form(...),
    age: int = Form(...),
    profession: str = Form(...),
    education: str = Form(...),
    location: str = Form(...),
    mobile: str = Form(...),
    audio: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Save audio file permanently
    file_extension = audio.filename.split(".")[-1]
    saved_filename = f"saved_audio/{uuid.uuid4()}.{file_extension}"
    
    with open(saved_filename, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)
    
    try:
        # 1. Transcribe audio
        try:
            transcription_response = await whisper_service.transcribe(saved_filename)
            transcript = transcription_response["text"]
            segments = transcription_response["segments"]
        except Exception as te:
            print(f"Transcription error: {te}")
            transcript = "AI Transcription failed."
            segments = []
        
        # 2. Extract structured info using LLM
        try:
            llm_data = await whisper_service.extract_structured_info(transcript)
        except Exception as ee:
            print(f"LLM extraction error: {ee}")
            llm_data = None
            
        # 3. Audit logic
        audit_result = perform_audit(
            transcript, int(age), name, profession, education, location, mobile, 
            segments=segments, audio_path=saved_filename, llm_data=llm_data
        )

        if transcript == "AI Transcription failed.":
            audit_result["is_emergency"] = True
        
        # 3. Save to database
        db_survey = Survey(
            name=name,
            form_age=age,
            form_profession=profession,
            form_education=education,
            form_location=location,
            form_mobile=mobile,
            transcript=transcript,
            detected_age=audit_result["detected_values"]["age"],
            detected_name=audit_result["detected_values"]["name"],
            detected_profession=audit_result["detected_values"]["profession"],
            detected_education=audit_result["detected_values"]["education"],
            detected_location=audit_result["detected_values"]["location"],
            detected_mobile=audit_result["detected_values"]["mobile"],
            question_timestamps=json.dumps(audit_result["timestamps"]["questions"]),
            audio_path=saved_filename,
            result=audit_result["status"],
            emotion=audit_result["sentiment"]["emotion"],
            meaning=audit_result["sentiment"]["meaning"],
            interpretation=audit_result["sentiment"]["interpretation"],
            full_result_json=json.dumps(audit_result)
        )
        db.add(db_survey)
        db.commit()
        db.refresh(db_survey)
        
        # Return result with web-accessible audio URL
        audit_result["audio_url"] = f"{BASE_URL}/audio/{os.path.basename(saved_filename)}"
        
        return {
            "id": db_survey.id,
            "transcript": transcript,
            "audit_result": audit_result
        }
    except Exception as e:
        print(f"Server Error: {e}")
        if os.path.exists(saved_filename):
            os.remove(saved_filename)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/fetch-uid/{uid}")
def fetch_uid_data(uid: str):
    """Fetch user registration details to auto-fill the frontend form."""
    logger.info(f"FETCH-UID: Searching for {uid}")
    excel_paths = ["../data_with_json.xlsx", "data_with_json.xlsx"]
    for d in [".", ".."]:
        if os.path.exists(d):
            for f in os.listdir(d):
                if f.endswith(".xlsx") and f != "data_with_json.xlsx":
                    excel_paths.append(os.path.join(d, f))
            
    row = None
    df_matched = None
    
    for excel_path in excel_paths:
        if not os.path.exists(excel_path): continue
        logger.info(f"FETCH-UID: Scanning {excel_path}")
        try:
            df = pd.read_excel(excel_path, header=None)
            current_uid = str(uid).strip()
            for i in range(len(df)):
                try:
                    # Check first 3 columns just in case
                    for col_idx in range(min(len(df.columns), 3)):
                        cell_val = str(df.iloc[i, col_idx]).strip()
                        cell_uid = cell_val.split('.')[0]
                        if cell_uid == current_uid:
                            logger.info(f"FETCH-UID: MATCH FOUND in {excel_path} row {i} col {col_idx}")
                            row = df.iloc[i]
                            df_matched = df
                            break
                    if row is not None: break
                except Exception as row_err:
                    continue # Skip bad rows
            if row is not None: break
        except Exception as e:
            logger.error(f"FETCH-UID: Error reading {excel_path}: {e}")
                
    try:
        if row is None:
            logger.warning(f"FETCH-UID: UID {uid} not found after scanning {len(excel_paths)} files.")
            raise HTTPException(status_code=404, detail=f"UID {uid} not found in any data source.")
            
        data = json.loads(row[2])
        reg_details = data.get("registration_details", [])
        
        # Default empty dict to map frontend form
        form_data = {
            "name": "", "age": "", "profession": "", "education": "Not Provided", "location": "", "mobile": ""
        }
        
        # Manual extraction based on observed keys
        for entry in reg_details:
            if isinstance(entry, list) and len(entry) >= 2:
                # Handle both [Value, Label] and [Instruction, Value, Label]
                if len(entry) >= 3:
                    val = str(entry[1]).strip()
                    label = str(entry[2]).strip().upper()
                else:
                    val = str(entry[0]).strip()
                    label = str(entry[1]).strip().upper()
                
                # Check mapping
                if label in ["FR NAME", "NAME", "NAME OF THE RESPONDENT", "FULL NAME", "RESPONDENT NAME"]:
                    form_data["name"] = val
                elif label in ["MOBILE NUMBER", "MOBILE", "PHONE"]:
                    form_data["mobile"] = val
                elif label in ["DOB", "DATE OF BIRTH"]:
                    # basic age calc (2026 - birth_year)
                    try:
                        year = int(re.search(r'\d{4}', val).group(0))
                        form_data["age"] = str(2026 - year)
                    except:
                        pass
                elif label in ["AREA", "LOCATION", "VILLAGE", "DISTRICT"]:
                    form_data["location"] = val
                elif label in ["OCCUPATION", "PROFESSION", "WORK"]:
                    form_data["profession"] = val
                elif label == "GENDER" and not form_data["name"]:
                    # In some weird UIDs (like 111379), labels are shifted
                    # If we see GENDER but Value at index 1 is something else...
                    pass
        
        # Final validation: If name contains "Surveyor", clear it
        if form_data["name"] and "surveyor" in form_data["name"].lower():
            form_data["name"] = ""
            
        # USER REQUEST: If name is still empty, set to "Not Provided"
        if not form_data["name"]:
            form_data["name"] = "Not Provided"
                
        return {"uid": current_uid, "form_data": form_data}
        
    except Exception as e:
        print(f"Error fetching UID: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ProcessUidRequest(BaseModel):
    uid: str

@app.post("/process-uid")
async def process_uid(request: ProcessUidRequest, db: Session = Depends(get_db)):
    """Automated backend processing without manual file upload."""
    uid = request.uid
    
    # Check if already processed to avoid re-running expense transcription
    existing = db.query(Survey).filter(
        (Survey.full_result_json.like(f'%"uid": "{uid}"%')) | (Survey.name == uid)
    ).order_by(Survey.id.desc()).first()
    
    # FORCED RE-PROCESS for UIDs to fix logic/formatting
    if uid in ["111379", "108417"]:
        existing = None

    if existing:
        print(f"DEBUG: Found existing audit for UID {uid} (ID: {existing.id}). Returning cached result.")
        try:
            full_result = json.loads(existing.full_result_json)
            return {
                "id": existing.id,
                "transcript": existing.transcript,
                "audit_result": full_result
            }
        except Exception:
            pass # Re-process if JSON fails

    try:
        print(f"DEBUG: Starting audit for UID {uid}")
        result = await run_automated_audit(uid, media_base_path="..")
        if "error" in result:
            print(f"DEBUG: Audit result error: {result['error']}")
            raise HTTPException(status_code=400, detail=result["error"])
            
        print(f"DEBUG: Audit completed. Saving audio...")
        audio_path = result.get("audio_path")
        if audio_path and os.path.exists(audio_path):
            import shutil
            filename = os.path.basename(audio_path)
            saved_filename = f"saved_audio/{uid}_{filename}"
            try:
                shutil.copyfile(audio_path, saved_filename)
                result["audio_url"] = f"http://localhost:8005/audio/{uid}_{filename}"
                print(f"DEBUG: Audio saved to {saved_filename}")
            except Exception as ae:
                print(f"DEBUG: Failed to copy audio: {ae}")

        print(f"DEBUG: Normalizing results for UID {uid}")
        za = result.get("z_audit", {})
        if not isinstance(za, dict): za = {}
        
        # 1. Normalize Evidence
        evidence = za.get("evidence", [])
        normalized_evidence = []
        if isinstance(evidence, str):
            for line in evidence.split(". "):
                if line.strip():
                    normalized_evidence.append({"issue": "Audit Note", "detail": line.strip() + "."})
        elif isinstance(evidence, list):
            for item in evidence:
                if isinstance(item, str):
                    normalized_evidence.append({"issue": "Observation", "detail": item})
                elif isinstance(item, dict):
                    normalized_evidence.append({
                        "issue": item.get("issue", "Detail"),
                        "detail": item.get("detail", item.get("description", str(item)))
                    })
        za["evidence"] = normalized_evidence
        
        # 2. Normalize Issues Detected
        issues = za.get("issues_detected", [])
        normalized_issues = []
        if isinstance(issues, list):
            for i in issues:
                i_str = str(i)
                if ":" in i_str and len(i_str) > 50:
                    parts = i_str.split(":", 1)
                    normalized_issues.append(parts[0].strip())
                    za["evidence"].append({"issue": parts[0].strip(), "detail": parts[1].strip()})
                elif len(i_str) > 30:
                    normalized_issues.append(i_str[:27] + "...")
                else:
                    normalized_issues.append(i_str)
        za["issues_detected"] = list(set(normalized_issues))
        
        # 3. Standardize Payment Decision
        pd_val = str(za.get("payment_decision", "No Payment")).lower()
        if "full" in pd_val: za["payment_decision"] = "Full Payment"
        elif "partial" in pd_val: za["payment_decision"] = "Partial Payment"
        else: za["payment_decision"] = "No Payment"

        print(f"DEBUG: Creating DB record for UID {uid}")
        det_vals = result.get("detected_values", {})
        if not isinstance(det_vals, dict): det_vals = {}
        
        timestamps = result.get("timestamps", {})
        if not isinstance(timestamps, dict): timestamps = {}
        q_timestamps = timestamps.get("questions", {})
        if not isinstance(q_timestamps, dict): q_timestamps = {}

        sentiment = result.get("sentiment", {})
        if not isinstance(sentiment, dict): sentiment = {}

        db_survey = Survey(
            name=str(det_vals.get("name", uid)),
            form_age=0,
            form_profession="N/A",
            form_education="N/A",
            form_location="N/A",
            form_mobile="N/A",
            transcript=str(result.get("transcript", "Transcript unavailable")),
            detected_age=det_vals.get("age", 0),
            detected_name=str(det_vals.get("name", "N/A")),
            detected_profession=str(det_vals.get("profession", "N/A")),
            detected_education=str(det_vals.get("education", "N/A")),
            detected_location=str(det_vals.get("location", "N/A")),
            detected_mobile=str(det_vals.get("mobile", "N/A")),
            question_timestamps=json.dumps(q_timestamps),
            audio_path=str(audio_path or f"uid_{uid}_audio"),
            result=str(result.get("status", "Unknown")),
            emotion=str(sentiment.get("emotion", "NEUTRAL")),
            meaning=str(sentiment.get("meaning", "NEUTRAL")),
            interpretation=str(sentiment.get("interpretation", "System Auto-Run")),
            full_result_json=json.dumps(result)
        )
        db.add(db_survey)
        db.commit()
        db.refresh(db_survey)
        print(f"DEBUG: DB record created with ID {db_survey.id}")
        
        return {
            "id": db_survey.id,
            "transcript": str(result.get("transcript", "")),
            "audit_result": result
        }
        
    except HTTPException: raise
    except Exception as e:
        import traceback
        print(f"CRITICAL ERROR processing UID {uid}:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/surveys")
def get_surveys(db: Session = Depends(get_db)):
    surveys = db.query(Survey).order_by(Survey.timestamp.desc()).all()
    results = []
    for s in surveys:
        # Convert to dict and add web-accessible fields
        s_dict = {c.name: getattr(s, c.name) for c in s.__table__.columns}
        
        # Parse timestamps back to dict for frontend
        if s_dict.get("question_timestamps"):
            try:
                s_dict["question_timestamps"] = json.loads(s_dict["question_timestamps"])
            except:
                s_dict["question_timestamps"] = {}
        
        # Generate audio URL
        if s_dict.get("audio_path"):
            s_dict["audio_url"] = f"{BASE_URL}/audio/{os.path.basename(s_dict['audio_path'])}"
        
        # Consistent mapping for frontend
        if s_dict.get("full_result_json"):
            try:
                s_dict["audit_result"] = json.loads(s_dict["full_result_json"])
                # Ensure audio_url is in the nested audit_result for ClipCard
                s_dict["audit_result"]["audio_url"] = s_dict["audio_url"]
            except:
                s_dict["audit_result"] = None
        else:
            # Fallback for old records
            s_dict["audit_result"] = {
                "status": s_dict.get("result"),
                "detected_values": {
                    "age": s_dict.get("detected_age"),
                    "name": s_dict.get("detected_name"),
                    "profession": s_dict.get("detected_profession"),
                    "education": s_dict.get("detected_education"),
                    "location": s_dict.get("detected_location"),
                    "mobile": s_dict.get("detected_mobile")
                },
                "timestamps": {
                    "questions": s_dict.get("question_timestamps") or {},
                    "detected": {}
                },
                "sentiment": {
                    "emotion": s_dict.get("emotion"),
                    "meaning": s_dict.get("meaning"),
                    "interpretation": s_dict.get("interpretation")
                },
                "audio_url": s_dict.get("audio_url")
            }
        
        results.append(s_dict)
    return results

@app.delete("/surveys/{survey_id}")
def delete_survey(survey_id: int, db: Session = Depends(get_db)):
    db_survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not db_survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    if db_survey.audio_path and os.path.exists(db_survey.audio_path):
        try: os.remove(db_survey.audio_path)
        except: pass
    db.delete(db_survey)
    db.commit()
    return {"message": "Survey deleted successfully"}

@app.get("/surveyors")
def get_surveyors():
    """List unique surveyors from the Excel file."""
    excel_path = "../data_with_json.xlsx"
    if not os.path.exists(excel_path):
        excel_path = "data_with_json.xlsx"
    if not os.path.exists(excel_path):
        return []
    
    try:
        df = pd.read_excel(excel_path, header=None)
        surveyors_count = {}
        for i in range(len(df)):
            try:
                row_json = json.loads(str(df.iloc[i, 2]))
                s_name = row_json.get("surveyor")
                if s_name:
                    surveyors_count[s_name] = surveyors_count.get(s_name, 0) + 1
            except: continue
        
        return [{"name": name, "count": count} for name, count in surveyors_count.items()]
    except Exception as e:
        logger.error(f"Error listing surveyors: {e}")
        return []

@app.get("/surveyor-payroll/{surveyor_name}")
def get_surveyor_payroll(surveyor_name: str, db: Session = Depends(get_db)):
    """Generate salary slip data for a specific surveyor."""
    excel_path = "../data_with_json.xlsx"
    if not os.path.exists(excel_path):
        excel_path = "data_with_json.xlsx"
        
    surveys_for_payroll = []
    
    try:
        df = pd.read_excel(excel_path, header=None)
        for i in range(len(df)):
            try:
                row_json = json.loads(str(df.iloc[i, 2]))
                if row_json.get("surveyor") == surveyor_name:
                    uid = str(df.iloc[i, 1]).split('.')[0]
                    # Try to find audited result in DB
                    db_survey = db.query(Survey).filter(Survey.full_result_json.like(f'%"uid": "{uid}"%')).first()
                    audit_data = {}
                    if db_survey:
                        audit_data = json.loads(db_survey.full_result_json)
                    
                    surveys_for_payroll.append({
                        "uid": uid,
                        "audit": audit_data,
                        "raw": row_json
                    })
            except: continue
            
        payroll = calculate_surveyor_payroll(surveyor_name, surveys_for_payroll)
        return payroll
    except Exception as e:
        logger.error(f"Error calculating payroll: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
@app.delete("/surveys")
def clear_all_surveys(db: Session = Depends(get_db)):
    surveys = db.query(Survey).all()
    for s in surveys:
        if s.audio_path and os.path.exists(s.audio_path):
            try: os.remove(s.audio_path)
            except: pass
            
    db.query(Survey).delete()
    db.commit()
    return {"message": "All surveys cleared"}