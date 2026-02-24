from database import Base
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Float,
    Date,
    DateTime,
    Text,
    JSON,
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    employeeId = Column(String, unique=True, index=True)
    role = Column(String)
    isActive = Column(Boolean, default=True)
    createdAt = Column(DateTime)


class Pillar(Base):
    __tablename__ = "pillars"

    id = Column(Integer, primary_key=True, index=True)
    pillarId = Column(String, unique=True, index=True)
    address = Column(String)
    locality = Column(String)
    coordinates = Column(JSON)


class Task(Base):
    __tablename__ = "tasks"

    task_id = Column(Integer, primary_key=True, index=True)
    pillar_id = Column(String)
    task_status = Column(String)
    due_date = Column(Date)
    created_date = Column(DateTime)
    created_by = Column(String)
    image_1 = Column(String)
    image_2 = Column(String)
    image_3 = Column(String)
    image_4 = Column(String)
    user_current_location = Column(JSON)
    updated_date = Column(DateTime)
    detection_result_id = Column(String)
    validation_status = Column(String)
    severity_validation = Column(String)
    priority_validation = Column(String)
    cost_estimation = Column(Float)
    remarks = Column(Text)
    validation_by = Column(String)
    maintainance_status = Column(String)
    work_log = Column(JSON, default=list)
    completion_evidence = Column(String)
    maintainace_validate_by = Column(String)


class ModelTraining(Base):
    __tablename__ = "model_training"

    id = Column(Integer, primary_key=True, index=True)
    image = Column(String)
    output_class = Column(String)


class Photo(Base):
    __tablename__ = "photos"

    photo_id = Column(String, primary_key=True, index=True)
    task_id = Column(Integer)
    inference = Column(JSON)
    height = Column(Float)
    width = Column(Float)
    x = Column(Float)
    y = Column(Float)
    created_date = Column(DateTime)


class Detection(Base):
    __tablename__ = "detections"

    detection_result_id = Column(String, primary_key=True, index=True)
    photo_id = Column(String)
    x = Column(Float)
    y = Column(Float)
    height = Column(Float)
    width = Column(Float)
    faulty_type = Column(String)
    confidence_level = Column(Float)
