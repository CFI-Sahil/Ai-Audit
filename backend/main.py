from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import shutil
import os
import uuid
import json

from database import SessionLocal, Survey
from whisper_service import whisper_service
from audit_logic import perform_audit

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
        
        # 2. Audit logic
        audit_result = perform_audit(transcript, age, name, profession, education, location, mobile, segments, saved_filename)
        
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
        audit_result["audio_url"] = f"http://localhost:8000/audio/{os.path.basename(saved_filename)}"
        
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
            s_dict["audio_url"] = f"http://localhost:8000/audio/{os.path.basename(s_dict['audio_path'])}"
        
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
