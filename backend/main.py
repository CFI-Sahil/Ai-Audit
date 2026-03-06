from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import shutil
import os
import uuid

from database import SessionLocal, Survey
from whisper_service import whisper_service
from audit_logic import perform_audit

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    audio: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Create temp directory if not exists
    os.makedirs("temp_audio", exist_ok=True)
    
    # Save audio file
    file_extension = audio.filename.split(".")[-1]
    temp_filename = f"temp_audio/{uuid.uuid4()}.{file_extension}"
    
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)
    
    try:
        # 1. Transcribe audio
        try:
            transcript = whisper_service.transcribe(temp_filename)
        except Exception as te:
            print(f"Transcription error: {te}")
            # Generic message that won't trigger a false 'Match'
            transcript = "AI Transcription failed (System FFmpeg missing). Please install FFmpeg to enable accurate age detection."
        
        # 2. Audit logic (pass name for name verification)
        audit_result = perform_audit(transcript, age, name)
        
        # 3. Save to database
        db_survey = Survey(
            name=name,
            form_age=age,
            transcript=transcript,
            detected_age=audit_result["detected_age"],
            detected_name=audit_result["detected_name"],
            result=audit_result["status"]
        )
        db.add(db_survey)
        db.commit()
        db.refresh(db_survey)
        
        return {
            "id": db_survey.id,
            "transcript": transcript,
            "audit_result": audit_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temp file
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

@app.get("/surveys")
def get_surveys(db: Session = Depends(get_db)):
    return db.query(Survey).order_by(Survey.timestamp.desc()).all()

@app.delete("/surveys/{survey_id}")
def delete_survey(survey_id: int, db: Session = Depends(get_db)):
    print(f"Incoming delete request for ID: {survey_id}")
    db_survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not db_survey:
        print(f"Survey with ID {survey_id} not found")
        raise HTTPException(status_code=404, detail="Survey not found")
    db.delete(db_survey)
    db.commit()
    print(f"Deleted survey with ID: {survey_id}")
    return {"message": "Survey deleted successfully"}

@app.delete("/surveys")
def clear_all_surveys(db: Session = Depends(get_db)):
    print("Incoming request to clear all surveys")
    db.query(Survey).delete()
    db.commit()
    print("Cleared all surveys")
