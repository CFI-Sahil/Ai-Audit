from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./survey.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Survey(Base):
    __tablename__ = "surveys"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    form_age = Column(String)
    form_profession = Column(String)
    form_education = Column(String)
    form_location = Column(String)
    form_mobile = Column(String)
    transcript = Column(String)
    detected_age = Column(String, nullable=True)
    detected_name = Column(String, nullable=True)
    detected_profession = Column(String, nullable=True)
    detected_education = Column(String, nullable=True)
    detected_location = Column(String, nullable=True)
    detected_mobile = Column(String, nullable=True)
    question_timestamps = Column(String, nullable=True) # JSON string
    audio_path = Column(String, nullable=True)
    result = Column(String)
    emotion = Column(String, nullable=True)
    meaning = Column(String, nullable=True)
    interpretation = Column(String, nullable=True)
    full_result_json = Column(String, nullable=True) # Full audit result as JSON
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

Base.metadata.create_all(bind=engine)
