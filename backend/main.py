from fastapi import FastAPI, Depends, Path, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Annotated
from sqlalchemy.orm import Session
from pydantic import BaseModel, StrictInt, Field, EmailStr
import models
from models import Users, Pillar, Task, DetectionResult, DetectionBox
from database import engine, SessionLocal
import os
from dotenv import load_dotenv
from datetime import datetime


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    )

models.Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]

class LoginRequest(BaseModel):
    email: EmailStr
    username: str

class TaskCreate(BaseModel):
    pillar_id:int
    due_date:datetime
    created_by:int

class TaskSubmit(BaseModel):
    image1:str
    image2:str
    image3:str
    image4:str
    user_current_location:str
    detection_result_id:str

class TaskValidation(BaseModel):
    validation_status:str
    severity_validation:str
    priority_validation:str
    cost_estimation:float
    remarks:str
    validation_by:int

class TaskMaintenance(BaseModel):
    maintainance_status:str
    work_log:str
    completion_evidence:str
    maintainace_validate_by:int

def run_ai_detection():

    # Replace this with YOLO / model inference
    return [
        {
            "image_index":1,
            "faulty_type":"Crack",
            "confidence_level":0.93,
            "x":120,
            "y":60,
            "width":40,
            "height":30
        },
        {
            "image_index":2,
            "faulty_type":"Rust",
            "confidence_level":0.88,
            "x":200,
            "y":90,
            "width":70,
            "height":50
        }
    ]

@app.post("/users/login")
def login_user(login:LoginRequest, db:db_dependency):

    user = db.query(Users).filter(
        Users.email == login.email,
        Users.username == login.username
    ).first()

    if not user:
        return {"exists":False}

    return {
        "exists":True,
        "user":{
            "id":user.id,
            "name":user.name,
            "email":user.email,
            "username":user.username,
            "employeeId":user.employeeId,
            "role":user.role
        }
    }
    
@app.get("/tasks")
def get_tasks(db:db_dependency):
    return db.query(Task).all()

@app.post("/tasks")
def create_task(task:TaskCreate, db:db_dependency):

    new_task = Task(
        pillar_id=task.pillar_id,
        task_status="Pending",
        due_date=task.due_date,
        created_date=datetime.utcnow(),
        created_by=task.created_by
    )

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    return new_task

@app.put("/tasks/{task_id}/submit")
def submit_task(task_id:int, data:TaskSubmit, db:db_dependency):

    task = db.query(Task).filter(Task.task_id==task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # -----------------------
    # 1️⃣ SAVE IMAGES
    # -----------------------
    task.image1 = data.image1
    task.image2 = data.image2
    task.image3 = data.image3
    task.image4 = data.image4
    task.user_current_location = data.user_current_location
    task.updated_date = datetime.utcnow()
    task.task_status = "Submitted"

    db.commit()

    # -----------------------
    # 2️⃣ RUN DETECTION
    # -----------------------
    ai_results = run_ai_detection()

    detection = DetectionResult(
        task_id=task_id,
        inference="Fault detected",
        created_date=datetime.utcnow()
    )

    db.add(detection)
    db.commit()
    db.refresh(detection)

    # -----------------------
    # 3️⃣ SAVE DETECTION BOXES
    # -----------------------
    for r in ai_results:
        box = DetectionBox(
            detection_result_id=detection.detection_result_id,
            image_index=r["image_index"],
            faulty_type=r["faulty_type"],
            confidence_level=r["confidence_level"],
            x=r["x"],
            y=r["y"],
            width=r["width"],
            height=r["height"]
        )
        db.add(box)

    # -----------------------
    # 4️⃣ UPDATE TASK FK
    # -----------------------
    task.detection_result_id = detection.detection_result_id
    db.commit()

    return {
        "message":"Task submitted and detection completed",
        "detection_result_id": detection.detection_result_id,
        "results": ai_results
    }

@app.get("/detection/{task_id}")
def get_detection(task_id:int, db:db_dependency):

    detection = db.query(DetectionResult)\
        .filter(DetectionResult.task_id==task_id)\
        .first()

    if not detection:
        return None

    boxes = db.query(DetectionBox)\
        .filter(DetectionBox.detection_result_id==detection.detection_result_id)\
        .all()

    return {
        "detection_result_id": detection.detection_result_id,
        "inference": detection.inference,
        "boxes": boxes
    }

@app.put("/tasks/{task_id}/validate")
def validate_task(task_id:int, data:TaskValidation, db:db_dependency):

    task = db.query(Task).filter(Task.task_id==task_id).first()

    if not task:
        raise HTTPException(status_code=404,detail="Task not found")

    task.validation_status = data.validation_status
    task.severity_validation = data.severity_validation
    task.priority_validation = data.priority_validation
    task.cost_estimation = data.cost_estimation
    task.remarks = data.remarks
    task.validation_by = data.validation_by
    task.task_status = "Validated"

    db.commit()

    return {"message":"Task validated"}

@app.put("/tasks/{task_id}/maintenance")
def maintenance_update(task_id:int, data:TaskMaintenance, db:db_dependency):

    task = db.query(Task).filter(Task.task_id==task_id).first()

    if not task:
        raise HTTPException(status_code=404,detail="Task not found")

    task.maintainance_status = data.maintainance_status
    task.work_log = data.work_log
    task.completion_evidence = data.completion_evidence
    task.maintainace_validate_by = data.maintainace_validate_by

    if data.maintainance_status == "Completed":
        task.task_status = "Completed"

    db.commit()

    return {"message":"Maintenance updated"}

