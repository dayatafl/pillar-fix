from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Annotated, Optional
from sqlalchemy.orm import Session, aliased
from pydantic import BaseModel, EmailStr
import models
from models import User, Pillar, Task, Photo, Detection
from database import engine, SessionLocal
from datetime import datetime
import uuid


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


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    username: str
    employeeId: str
    role: str
    password: str
    locality: Optional[str] = None


class UserUpdate(BaseModel):
    name: str
    email: EmailStr
    username: str
    employeeId: str
    role: str
    locality: Optional[str] = None


class TaskCreate(BaseModel):
    pillar_id: str
    due_date: datetime


class TaskReassign(BaseModel):
    new_employee_id: str


class TaskSubmit(BaseModel):
    image1: str
    image2: str
    image3: str
    image4: str
    # Frontend sends { lat: float, lng: float }
    user_current_location: dict


class TaskValidation(BaseModel):
    validation_status: str
    severity_validation: str
    priority_validation: str
    cost_estimation: float
    remarks: str
    validation_by: str        # employeeId of the supervisor who validated


class TaskMaintenance(BaseModel):
    maintenance_status: str   # fixed spelling
    work_log: dict            # { action: str, notes: str, images: list[str] }
    completion_evidence: str  # URL / base64 of the completion image
    maintenance_validate_by: str  # fixed spelling – employeeId


# ---------------------------------------------------------------------------
# AI detection stub
# Replace this function body with your real YOLO / model inference call.
# The signature accepts image URLs so you can pass them to the model.
# ---------------------------------------------------------------------------

def run_ai_detection(image_urls: list[str]) -> list[dict]:
    """
    Stub — replace with real model inference.
    Returns a list of bounding-box detections across all images.
    """
    return [
        {
            "image_index": 1,
            "faulty_type": "Crack",
            "confidence_level": 0.93,
            "x": 120,
            "y": 60,
            "width": 40,
            "height": 30,
        },
        {
            "image_index": 2,
            "faulty_type": "Rust",
            "confidence_level": 0.88,
            "x": 200,
            "y": 90,
            "width": 70,
            "height": 50,
        },
    ]


# ---------------------------------------------------------------------------
# Helper: compute overall risk from detection results
# ---------------------------------------------------------------------------

def compute_overall_risk(detections: list[dict]) -> str:
    if not detections:
        return "Low"
    max_conf = max(d["confidence_level"] for d in detections)
    if max_conf >= 0.9:
        return "High"
    if len(detections) > 1:
        return "Medium"
    return "Low"


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@app.post("/users/login")
def login_user(login: LoginRequest, db: db_dependency):
    """
    Frontend sends: { email, username }
    NOTE: The current frontend uses a hardcoded mock — no real API call.
    When you wire this up, replace the frontend's mock with a fetch() here.
    Expected response shape matches what frontend stores in currentUser:
      { exists, user: { id, name, email, username, employeeId, role } }
    """
    user = db.query(User).filter(
        User.email == login.email,
    ).first()

    if not user or not login.password == user.password:
        return {"exists": False}

    return {
        "exists": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "username": user.username,
            "employeeId": user.employeeId,
            "role": user.role,          # must be lowercase: technician / supervisor / manager / admin
            "isActive": user.isActive,
            "locality": user.locality,
        },
    }


# ---------------------------------------------------------------------------
# Users – for the UserManagement component
# ---------------------------------------------------------------------------

@app.get("/users")
def get_users(db: db_dependency):
    """
    UserManagement component expects each user to have:
      { id, name, email, username, employeeId, role, isActive }
    """
    users = db.query(User).all()
    return [
        {
            "id": str(u.id),
            "name": u.name,
            "email": u.email,
            "username": u.username,
            "employeeId": u.employeeId,
            "role": u.role,
            "isActive": u.isActive,
            "createdAt": u.createdAt,
            "locality": u.locality,
        }
        for u in users
    ]


@app.post("/users")
def create_user(data: UserCreate, db: db_dependency):
    """
    Called by handleCreateUser in UserManagement.jsx.
    Sends: { name, email, username, employeeId, role, password, locality }
    Returns the new user in the same shape GET /users returns.
    """
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")

    if db.query(User).filter(User.employeeId == data.employeeId).first():
        raise HTTPException(status_code=400, detail="Employee ID already exists")

    new_user = User(
        name=data.name,
        email=data.email,
        username=data.username,
        employeeId=data.employeeId,
        role=data.role,
        password=data.password,
        locality=data.locality if data.locality else None,
        isActive=True,
        createdAt=datetime.utcnow(),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "id": str(new_user.id),
        "name": new_user.name,
        "email": new_user.email,
        "username": new_user.username,
        "employeeId": new_user.employeeId,
        "role": new_user.role,
        "isActive": new_user.isActive,
        "createdAt": new_user.createdAt.isoformat(),
        "locality": new_user.locality,
    }

@app.put("/users/{user_id}")
def update_user(user_id: int, data: UserUpdate, db: db_dependency):
    """
    Called by handleUpdateUser in UserManagement.jsx.
    Sends: { name, email, username, employeeId, role, locality }
    Edit dialog does NOT send password — password changes need a separate flow.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check uniqueness, excluding current user
    if db.query(User).filter(User.email == data.email, User.id != user_id).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    if db.query(User).filter(User.username == data.username, User.id != user_id).first():
        raise HTTPException(status_code=400, detail="Username already exists")

    if db.query(User).filter(User.employeeId == data.employeeId, User.id != user_id).first():
        raise HTTPException(status_code=400, detail="Employee ID already exists")

    user.name = data.name
    user.email = data.email
    user.username = data.username
    user.employeeId = data.employeeId
    user.role = data.role
    user.locality = data.locality

    db.commit()

    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "username": user.username,
        "employeeId": user.employeeId,
        "role": user.role,
        "isActive": user.isActive,
        "createdAt": user.createdAt.isoformat() if user.createdAt else None,
        "locality": user.locality if user.locality else None,
    }


@app.patch("/users/{user_id}/status")
def toggle_user_status(user_id: int, db: db_dependency):
    """
    Called by handleToggleUserStatus (the Switch toggle) in UserManagement.jsx.
    Flips isActive between True and False.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.isActive = not user.isActive
    db.commit()

    return {
        "id": str(user.id),
        "isActive": user.isActive,
        "message": f"User {'activated' if user.isActive else 'deactivated'}",
    }


@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: db_dependency):
    """
    Called by confirmDeleteUser in UserManagement.jsx.
    Hard-deletes the user row. Consider soft-delete (isActive=False) for production.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()

    return {"message": f"User {user.name} deleted"}


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

@app.get("/tasks")
def get_tasks(db: db_dependency):
    """
    TechnicianDashboard / EnhancedMapView expect each task to have:
      { id, pillarId, location, address, locality, coordinates, assignedTo, status, dueDate, createdAt }
    """
    Technician = aliased(User)

    rows = (
        db.query(
            Task.task_id,
            Task.pillar_id,
            Task.task_status,
            Task.due_date,
            Task.created_date,
            Pillar.address,
            Pillar.locality,
            Pillar.coordinates,
            Technician.name.label("technician_name"),
        )
        .outerjoin(Pillar, Pillar.pillarId == Task.pillar_id)
        .outerjoin(Technician, Technician.employeeId == Task.assigned_to)
        .all()
    )

    return [
        {
            "id": str(r.task_id),
            "pillarId": r.pillar_id,
            "location": r.address,       # frontend uses "location" as the display name
            "address": r.address,
            "locality": r.locality,
            "coordinates": r.coordinates,  # { lat, lng } JSON stored in DB
            "assignedTo": r.technician_name,
            "status": r.task_status,
            "dueDate": r.due_date.isoformat() if r.due_date else None,
            "createdAt": r.created_date.isoformat() if r.created_date else None,
        }
        for r in rows
    ]


@app.post("/tasks")
def create_task(task: TaskCreate, db: db_dependency):
    """
    Auto-assigns the first available technician in the pillar's locality.
    Frontend 'Create Task' dialog currently works locally (mock) —
    wire it up by calling POST /tasks with { pillar_id, due_date }.
    """
    pillar = db.query(Pillar).filter(Pillar.pillarId == task.pillar_id).first()
    if not pillar:
        raise HTTPException(status_code=404, detail="Pillar not found")

    # Roles stored lowercase to match frontend convention
    technician = db.query(User).filter(
        User.role == "technician",
        User.locality == pillar.locality,
        User.isActive == True,
    ).first()

    if not technician:
        raise HTTPException(
            status_code=404,
            detail=f"No active technician found for locality: {pillar.locality}",
        )

    new_task = Task(
        pillar_id=task.pillar_id,
        due_date=task.due_date,
        assigned_to=technician.employeeId,
        created_by=technician.employeeId,   # who created this task record
        task_status="Pending",
        created_date=datetime.utcnow(),
        updated_date=datetime.utcnow(),
    )

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    return {
        "message": "Task created and technician assigned",
        "task_id": new_task.task_id,
        "assigned_to": technician.employeeId,
        "locality": pillar.locality,
    }


@app.put("/tasks/{task_id}/reassign")
def reassign_task(task_id: int, data: TaskReassign, db: db_dependency):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.task_status == "Completed":
        raise HTTPException(status_code=400, detail="Completed task cannot be reassigned")

    technician = db.query(User).filter(
        User.employeeId == data.new_employee_id,
        User.role == "technician",   # lowercase, matching DB convention
        User.isActive == True,
    ).first()

    if not technician:
        raise HTTPException(status_code=404, detail="Technician not found or inactive")

    old_technician = task.assigned_to
    task.assigned_to = technician.employeeId
    task.updated_date = datetime.utcnow()

    db.commit()

    return {
        "message": "Task reassigned successfully",
        "task_id": task_id,
        "previous_technician": old_technician,
        "new_technician": technician.employeeId,
    }


@app.put("/tasks/{task_id}/submit")
def submit_task(task_id: int, data: TaskSubmit, db: db_dependency):
    """
    AuditForm submits 4 base64 images + GPS coordinates.
    After saving, runs AI detection and stores results in Photo + Detection tables.

    Returns detection results so frontend can immediately show the AI overlay.
    Frontend shape expected by DetectionResults:
      [{ imageUrl, side, boundingBoxes: [{ x, y, width, height, faultType, confidence }], overallRisk }]
    """
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Save images and location
    task.image_1 = data.image1
    task.image_2 = data.image2
    task.image_3 = data.image3
    task.image_4 = data.image4
    task.user_current_location = data.user_current_location   # { lat, lng }
    task.task_status = "Submitted"
    task.updated_date = datetime.utcnow()
    db.commit()

    # Run AI detection
    image_urls = [data.image1, data.image2, data.image3, data.image4]
    ai_results = run_ai_detection(image_urls)

    inference_json = {
        "status": "Fault detected" if ai_results else "No Fault",
        "total_detection": len(ai_results),
        "detections": ai_results,
    }

    photo_id = str(uuid.uuid4())
    photo = Photo(
        photo_id=photo_id,
        task_id=task_id,
        inference=inference_json,
        created_date=datetime.utcnow(),
    )
    db.add(photo)
    db.commit()

    for r in ai_results:
        box = Detection(
            photo_id=photo_id,
            task_id=task_id,
            image_index=r["image_index"],
            x=r["x"],
            y=r["y"],
            width=r["width"],
            height=r["height"],
            faulty_type=r["faulty_type"],
            confidence_level=r["confidence_level"],
        )
        db.add(box)

    db.commit()

    # Build response in the shape DetectionResults component expects
    sides = ["front", "right", "back", "left"]
    images = [data.image1, data.image2, data.image3, data.image4]
    overall_risk = compute_overall_risk(ai_results)

    detection_results = [
        {
            "imageUrl": images[i],
            "side": sides[i],
            "boundingBoxes": [
                {
                    "x": r["x"],
                    "y": r["y"],
                    "width": r["width"],
                    "height": r["height"],
                    "faultType": r["faulty_type"],
                    "confidence": r["confidence_level"],
                }
                for r in ai_results
                if r["image_index"] == i + 1
            ],
            "overallRisk": overall_risk,
        }
        for i in range(4)
    ]

    return {
        "message": "Task submitted and detection completed",
        "photo_id": photo_id,
        "detectionResults": detection_results,     # matches frontend 'detectionResults' key
        "overallRisk": overall_risk,
    }


@app.get("/detection/{task_id}")
def get_detection(task_id: int, db: db_dependency):
    """
    Returns detection results for a previously submitted task.
    Shape matches DetectionResults component expectations.
    """
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    photo = db.query(Photo).filter(Photo.task_id == task_id).first()
    if not photo:
        return []

    boxes = db.query(Detection).filter(Detection.photo_id == photo.photo_id).all()

    sides = ["front", "right", "back", "left"]
    images = [task.image_1, task.image_2, task.image_3, task.image_4]

    all_detections = [
        {
            "x": b.x,
            "y": b.y,
            "width": b.width,
            "height": b.height,
            "faulty_type": b.faulty_type,
            "confidence_level": b.confidence_level,
            "image_index": b.image_index,
        }
        for b in boxes
    ]

    overall_risk = compute_overall_risk(all_detections)

    return [
        {
            "imageUrl": images[i],
            "side": sides[i],
            "boundingBoxes": [
                {
                    "x": d["x"],
                    "y": d["y"],
                    "width": d["width"],
                    "height": d["height"],
                    "faultType": d["faulty_type"],
                    "confidence": d["confidence_level"],
                }
                for d in all_detections
                if d["image_index"] == i + 1
            ],
            "overallRisk": overall_risk,
        }
        for i in range(4)
    ]


@app.put("/tasks/{task_id}/validate")
def validate_task(task_id: int, data: TaskValidation, db: db_dependency):
    """
    SupervisorReview calls this when approving a submission.
    Stores severity, priority, cost, remarks, who validated.
    """
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.validation_status = data.validation_status
    task.severity_validation = data.severity_validation
    task.priority_validation = data.priority_validation
    task.cost_estimation = data.cost_estimation
    task.remarks = data.remarks
    task.validation_by = data.validation_by
    task.task_status = "Validated"
    task.updated_date = datetime.utcnow()

    db.commit()

    return {"message": "Task validated"}


@app.put("/tasks/{task_id}/maintenance")
def maintenance_update(task_id: int, data: TaskMaintenance, db: db_dependency):
    """
    MaintenanceDetail calls this to log work and update maintenance status.
    work_log is a JSON object: { action, notes, images[] }
    """
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Append new log entry to existing list
    existing_logs = task.work_log or []
    new_log = {
        **data.work_log,
        "timestamp": datetime.utcnow().isoformat(),
    }
    task.work_log = existing_logs + [new_log]

    task.maintenance_status = data.maintenance_status
    task.completion_evidence = data.completion_evidence
    task.maintenance_validate_by = data.maintenance_validate_by
    task.updated_date = datetime.utcnow()

    if data.maintenance_status == "Completed":
        task.task_status = "Completed"

    db.commit()

    return {"message": "Maintenance updated"}