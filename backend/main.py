from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Annotated, Optional
from sqlalchemy.orm import Session, aliased
from pydantic import BaseModel, EmailStr, Field
import models
from models import User, Pillar, Task, Photo, Detection
from database import engine, SessionLocal, upload_image_to_gcs, get_signed_url, sign_image_list
from datetime import datetime
import uuid
import math
import os
import json

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate


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
    created_by: str


class TaskReassign(BaseModel):
    new_employee_id: str


class TaskSubmit(BaseModel):
    image1: str
    image2: str
    image3: str
    image4: str
    user_current_location: dict


class TaskValidation(BaseModel):
    validation_status: str
    severity_validation: str
    cost_estimation: float
    remarks: str
    validation_by: str


class TaskMaintenance(BaseModel):
    maintenance_status: str
    action: str
    notes: str
    images: Optional[list] = []
    logged_by: str
    completion_evidence: Optional[str] = ""
    maintenance_validate_by: Optional[str] = None


# ---------------------------------------------------------------------------
# Analytics output schemas (LangChain structured output)
# ---------------------------------------------------------------------------

class MonthProjection(BaseModel):
    month: str        = Field(description="3-letter month abbreviation e.g. 'Apr'")
    projected: float  = Field(description="Projected reactive maintenance cost in RM")
    preventive: float = Field(description="Estimated cost with preventive maintenance adopted (RM)")


class SeverityInsight(BaseModel):
    level: str        = Field(description="Severity level: Critical | High | Medium | Low")
    count: int        = Field(description="Number of pillars at this severity level")
    percentage: float = Field(description="Percentage share of total pillars (0-100)")
    analysis: str     = Field(description="1-2 sentence analysis of this severity tier and its implications")
    urgency: str      = Field(description="Recommended response timeframe e.g. Within 24 hours")


class FaultTypeInsight(BaseModel):
    fault_type: str        = Field(description="Fault name e.g. Crack, Rust, Spalling")
    occurrences: int       = Field(description="Total AI detections of this fault type")
    avg_confidence: float  = Field(description="Mean AI detection confidence 0.0-1.0")
    risk_contribution: str = Field(description="Low | Medium | High")
    recommendation: str    = Field(description="Specific actionable maintenance recommendation")


class AnalyticsInsightsReport(BaseModel):
    insight: str               = Field(description="2-3 sentence executive summary of maintenance health and cost trends")
    risk_level: str            = Field(description="Overall portfolio risk: Low | Medium | High | Critical")
    potential_savings: float   = Field(description="Total RM savings achievable over 6 months by adopting preventive maintenance")
    cost_projection: list[MonthProjection]      = Field(description="Exactly 6 monthly cost projections starting from the next calendar month")
    severity_insights: list[SeverityInsight]    = Field(description="One entry per severity level that has at least 1 pillar")
    severity_summary: str                       = Field(description="1-2 sentence overall severity portfolio assessment")
    fault_type_insights: list[FaultTypeInsight] = Field(description="One entry per fault type sorted by occurrences descending")
    fault_summary: str         = Field(description="1-2 sentence summary of dominant fault patterns")
    recommendations: list[str] = Field(description="Exactly 3 specific actionable recommendations")


# ---------------------------------------------------------------------------
# Analytics LangChain chain
# ---------------------------------------------------------------------------

_SYSTEM_INSTRUCTION = """You are a senior infrastructure analytics specialist for a Malaysian utility
company managing roadside utility pillars (concrete/metal posts).

You MUST populate ALL 9 fields of the AnalyticsInsightsReport — never omit any field.
If data is sparse, use reasonable estimates and note it in the analysis text.

COST PROJECTION (cost_projection) — required, exactly 6 entries
- Start from next_projection_month, produce 6 consecutive months.
- Base projected on avg_cost_per_task_rm x estimated monthly volume.
  Use monthly_costs_this_year as baseline if available; otherwise estimate
  monthly volume as max(1, total_approved_tasks / months_elapsed_this_year).
- preventive = projected x 0.65 (35% saving from preventive maintenance).
- If total_approved_tasks is 0, use RM 5000/month as a conservative placeholder.

SEVERITY INSIGHTS (severity_insights) — required, one entry per level in severity_distribution
- If severity_distribution is empty, produce one entry:
  level=Unknown, count=0, percentage=0.0,
  analysis=No severity data recorded yet, urgency=Assess on next inspection.
- percentage = (count / total_approved_tasks) x 100, rounded to 1 decimal.
- Urgency: Critical=Within 24-48 hours, High=Within 1 week,
           Medium=Within 1 month, Low=Scheduled next quarter.

FAULT TYPE INSIGHTS (fault_type_insights) — required, one entry per fault in fault_type_frequency
- If fault_type_frequency is empty, produce one placeholder entry.
- Sort by occurrences descending.
- risk_contribution: High = avg_confidence > 0.85 AND occurrences >= 3;
                     Medium = occurrences >= 2; Low = otherwise.
- recommendation must name a specific maintenance action.

RECOMMENDATIONS (recommendations) — required, exactly 3 strings.
severity_summary and fault_summary — required, always non-empty strings.
All RM figures must be realistic for Malaysian infrastructure context."""


def _build_analytics_chain():
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=os.environ.get("GEMINI_API_KEY"),
        temperature=0,
    )

    structured_llm = llm.with_structured_output(AnalyticsInsightsReport)

    # System message goes in the prompt template (not the constructor)
    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            _SYSTEM_INSTRUCTION,
        ),
        (
            "human",
            "Aggregated maintenance statistics:\n\n{stats}\n\nGenerate the complete analytics report. All 9 fields are required.",
        ),
    ])

    return prompt | structured_llm


# Built once at module load — reused on every request
_analytics_chain = _build_analytics_chain()


# ---------------------------------------------------------------------------
# Analytics stats aggregation
# ---------------------------------------------------------------------------

def _aggregate_stats(db: Session) -> dict:
    approved_tasks = (
        db.query(Task)
        .filter(Task.validation_status == "Approved")
        .all()
    )

    total_cost      = sum(t.cost_estimation or 0 for t in approved_tasks)
    avg_cost        = total_cost / len(approved_tasks) if approved_tasks else 0
    completed_count = sum(1 for t in approved_tasks if t.task_status == "Completed")
    in_progress     = sum(1 for t in approved_tasks if t.maintenance_status == "In Progress")
    pending         = sum(1 for t in approved_tasks if (t.maintenance_status or "Pending") == "Pending")

    severity_counts: dict[str, int] = {}
    for t in approved_tasks:
        sev = t.severity_validation or "Unknown"
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

    all_detections = db.query(Detection).all()
    fault_freq:       dict[str, int]         = {}
    fault_confidence: dict[str, list[float]] = {}
    for d in all_detections:
        fault_freq[d.faulty_type] = fault_freq.get(d.faulty_type, 0) + 1
        fault_confidence.setdefault(d.faulty_type, []).append(d.confidence_level)

    fault_avg_confidence = {
        ft: round(sum(confs) / len(confs), 3)
        for ft, confs in fault_confidence.items()
    }

    locality_stats: dict[str, dict] = {}
    all_joined = (
        db.query(Task, Pillar)
        .outerjoin(Pillar, Pillar.pillarId == Task.pillar_id)
        .filter(Task.validation_status == "Approved")
        .all()
    )
    for task, pillar in all_joined:
        loc = (pillar.locality if pillar else None) or "Unknown"
        if loc not in locality_stats:
            locality_stats[loc] = {"count": 0, "total_cost": 0, "critical": 0}
        locality_stats[loc]["count"]      += 1
        locality_stats[loc]["total_cost"] += task.cost_estimation or 0
        if task.severity_validation == "Critical":
            locality_stats[loc]["critical"] += 1

    now        = datetime.utcnow()
    year_start = datetime(now.year, 1, 1)
    monthly_tasks = db.query(Task).filter(Task.created_date >= year_start).all()

    monthly_counts: dict[str, int]   = {}
    monthly_costs:  dict[str, float] = {}
    for t in monthly_tasks:
        if t.created_date:
            key = t.created_date.strftime("%b")
            monthly_counts[key] = monthly_counts.get(key, 0) + 1
            monthly_costs[key]  = monthly_costs.get(key, 0) + (t.cost_estimation or 0)

    avg_confidence = (
        sum(d.confidence_level for d in all_detections) / len(all_detections)
        if all_detections else 0.0
    )

    next_month = (
        datetime(now.year + 1, 1, 1) if now.month == 12
        else datetime(now.year, now.month + 1, 1)
    ).strftime("%b")

    return {
        "snapshot_date":                 now.strftime("%Y-%m-%d"),
        "next_projection_month":         next_month,
        "total_approved_tasks":          len(approved_tasks),
        "total_cost_rm":                 round(total_cost, 2),
        "avg_cost_per_task_rm":          round(avg_cost, 2),
        "completed_maintenance":         completed_count,
        "in_progress_maintenance":       in_progress,
        "pending_maintenance":           pending,
        "severity_distribution":         severity_counts,
        "fault_type_frequency":          fault_freq,
        "fault_type_avg_confidence":     fault_avg_confidence,
        "locality_breakdown":            locality_stats,
        "monthly_task_counts_this_year": monthly_counts,
        "monthly_costs_this_year":       monthly_costs,
        "ai_avg_detection_confidence":   round(avg_confidence, 3),
        "total_detections":              len(all_detections),
    }


# ---------------------------------------------------------------------------
# AI detection stub — replace with real YOLO inference
# ---------------------------------------------------------------------------

def run_ai_detection(image_urls: list[str]) -> list[dict]:
    return [
        {"image_index": 1, "faulty_type": "Crack", "confidence_level": 0.93,
         "x": 120, "y": 60, "width": 40, "height": 30},
        {"image_index": 2, "faulty_type": "Rust",  "confidence_level": 0.88,
         "x": 200, "y": 90, "width": 70, "height": 50},
    ]


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
async def login_user(login: LoginRequest, db: db_dependency):
    user = db.query(User).filter(User.email == login.email).first()
    if not user or login.password != user.password:
        return {"exists": False}
    return {
        "exists": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "username": user.username,
            "employeeId": user.employeeId,
            "role": user.role,
            "isActive": user.isActive,
            "locality": user.locality,
        },
    }


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@app.get("/users")
async def get_users(db: db_dependency):
    return [
        {
            "id": str(u.id), "name": u.name, "email": u.email,
            "username": u.username, "employeeId": u.employeeId,
            "role": u.role, "isActive": u.isActive,
            "createdAt": u.createdAt, "locality": u.locality,
        }
        for u in db.query(User).all()
    ]


@app.post("/users")
async def create_user(data: UserCreate, db: db_dependency):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "Email already exists")
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(400, "Username already exists")
    if db.query(User).filter(User.employeeId == data.employeeId).first():
        raise HTTPException(400, "Employee ID already exists")
    u = User(
        name=data.name, email=data.email, username=data.username,
        employeeId=data.employeeId, role=data.role, password=data.password,
        locality=data.locality or None, isActive=True, createdAt=datetime.utcnow(),
    )
    db.add(u); db.commit(); db.refresh(u)
    return {
        "id": str(u.id), "name": u.name, "email": u.email,
        "username": u.username, "employeeId": u.employeeId,
        "role": u.role, "isActive": u.isActive,
        "createdAt": u.createdAt.isoformat(), "locality": u.locality,
    }


@app.put("/users/{user_id}")
async def update_user(user_id: int, data: UserUpdate, db: db_dependency):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "User not found")
    if db.query(User).filter(User.email == data.email, User.id != user_id).first():
        raise HTTPException(400, "Email already exists")
    if db.query(User).filter(User.username == data.username, User.id != user_id).first():
        raise HTTPException(400, "Username already exists")
    if db.query(User).filter(User.employeeId == data.employeeId, User.id != user_id).first():
        raise HTTPException(400, "Employee ID already exists")
    u.name = data.name; u.email = data.email; u.username = data.username
    u.employeeId = data.employeeId; u.role = data.role; u.locality = data.locality
    db.commit()
    return {
        "id": str(u.id), "name": u.name, "email": u.email,
        "username": u.username, "employeeId": u.employeeId,
        "role": u.role, "isActive": u.isActive,
        "createdAt": u.createdAt.isoformat() if u.createdAt else None,
        "locality": u.locality or None,
    }


@app.patch("/users/{user_id}/status")
async def toggle_user_status(user_id: int, db: db_dependency):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "User not found")
    u.isActive = not u.isActive
    db.commit()
    return {
        "id": str(u.id), "isActive": u.isActive,
        "message": f"User {'activated' if u.isActive else 'deactivated'}",
    }


@app.delete("/users/{user_id}")
async def delete_user(user_id: int, db: db_dependency):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "User not found")
    db.delete(u); db.commit()
    return {"message": f"User {u.name} deleted"}


# ---------------------------------------------------------------------------
# Pillars & Tasks
# ---------------------------------------------------------------------------

@app.get("/pillars")
async def get_pillars(db: db_dependency):
    active_ids = {
        r[0] for r in db.query(Task.pillar_id)
        .filter(Task.task_status.notin_(["Completed"])).all()
    }
    return [
        {"pillarId": p.pillarId, "address": p.address, "locality": p.locality}
        for p in db.query(Pillar).all()
        if p.pillarId not in active_ids
    ]


@app.get("/tasks")
async def get_tasks(db: db_dependency):
    Technician = aliased(User)
    rows = (
        db.query(
            Task.task_id, Task.pillar_id, Task.task_status, Task.due_date,
            Task.created_date, Pillar.address, Pillar.locality, Pillar.coordinates,
            Technician.name.label("technician_name"),
        )
        .outerjoin(Pillar, Pillar.pillarId == Task.pillar_id)
        .outerjoin(Technician, Technician.employeeId == Task.assigned_to)
        .all()
    )
    return [
        {
            "id": str(r.task_id), "pillarId": r.pillar_id,
            "location": r.address, "address": r.address,
            "locality": r.locality, "coordinates": r.coordinates,
            "assignedTo": r.technician_name, "status": r.task_status,
            "dueDate": r.due_date.isoformat() if r.due_date else None,
            "createdAt": r.created_date.isoformat() if r.created_date else None,
        }
        for r in rows
    ]


def _haversine_km(lat1, lng1, lat2, lng2):
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi, dlambda = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _technician_centroid(tech_employee_id, db):
    active = ["Pending", "In Progress", "Submitted", "Validated"]
    pids = db.query(Task.pillar_id).filter(
        Task.assigned_to == tech_employee_id,
        Task.task_status.in_(active),
    ).all()
    if not pids:
        return None
    coords = []
    for (pid,) in pids:
        p = db.query(Pillar).filter(Pillar.pillarId == pid).first()
        if p and p.coordinates:
            coords.append((p.coordinates["lat"], p.coordinates["lng"]))
    if not coords:
        return None
    return (sum(c[0] for c in coords) / len(coords), sum(c[1] for c in coords) / len(coords))


def _locality_centroid(locality, db):
    pillars = db.query(Pillar).filter(Pillar.locality == locality).all()
    coords  = [(p.coordinates["lat"], p.coordinates["lng"]) for p in pillars if p.coordinates]
    if not coords:
        return None
    return (sum(c[0] for c in coords) / len(coords), sum(c[1] for c in coords) / len(coords))


@app.post("/tasks")
async def create_task(task: TaskCreate, db: db_dependency):
    pillar = db.query(Pillar).filter(Pillar.pillarId == task.pillar_id).first()
    if not pillar:
        raise HTTPException(404, "Pillar not found")
    if not pillar.coordinates:
        raise HTTPException(400, "Pillar has no coordinates")

    tlat, tlng = pillar.coordinates["lat"], pillar.coordinates["lng"]
    techs = db.query(User).filter(User.role == "technician", User.isActive == True).all()
    if not techs:
        raise HTTPException(404, "No active technicians found")

    active = ["Pending", "In Progress", "Submitted", "Validated"]
    best, best_d, best_w = None, float("inf"), float("inf")
    for tech in techs:
        c = _technician_centroid(tech.employeeId, db) or \
            (_locality_centroid(tech.locality, db) if tech.locality else None)
        if not c:
            continue
        d = _haversine_km(tlat, tlng, c[0], c[1])
        w = db.query(Task).filter(
            Task.assigned_to == tech.employeeId,
            Task.task_status.in_(active),
        ).count()
        if d < best_d or (d == best_d and w < best_w):
            best, best_d, best_w = tech, d, w

    if not best:
        raise HTTPException(404, "No technician with location data found")

    t = Task(
        pillar_id=task.pillar_id, due_date=task.due_date,
        assigned_to=best.employeeId, created_by=task.created_by,
        task_status="Pending", created_date=datetime.utcnow(), updated_date=datetime.utcnow(),
    )
    db.add(t); db.commit(); db.refresh(t)
    return {
        "message": "Task created and assigned to nearest technician",
        "task_id": t.task_id, "assigned_to": best.employeeId,
        "assigned_to_name": best.name,
        "distance_km": round(best_d, 2), "active_tasks": best_w,
    }


@app.put("/tasks/{task_id}/reassign")
async def reassign_task(task_id: int, data: TaskReassign, db: db_dependency):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    if task.task_status == "Completed":
        raise HTTPException(400, "Cannot reassign completed task")
    tech = db.query(User).filter(
        User.employeeId == data.new_employee_id,
        User.role == "technician", User.isActive == True,
    ).first()
    if not tech:
        raise HTTPException(404, "Technician not found or inactive")
    old = task.assigned_to
    task.assigned_to = tech.employeeId
    task.updated_date = datetime.utcnow()
    db.commit()
    return {"message": "Task reassigned", "task_id": task_id,
            "previous_technician": old, "new_technician": tech.employeeId}


@app.put("/tasks/{task_id}/submit")
async def submit_task(task_id: int, data: TaskSubmit, db: db_dependency):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    sides = ["front", "right", "back", "left"]
    raw   = [data.image1, data.image2, data.image3, data.image4]
    urls  = [
        upload_image_to_gcs(img, f"audit/task_{task_id}_{sides[i]}_{uuid.uuid4().hex[:8]}.jpg")
        for i, img in enumerate(raw)
    ]

    task.image_1 = urls[0]; task.image_2 = urls[1]
    task.image_3 = urls[2]; task.image_4 = urls[3]
    task.user_current_location = data.user_current_location
    task.task_status = "Submitted"
    task.updated_date = datetime.utcnow()
    db.commit()

    ai       = run_ai_detection(raw)
    photo_id = str(uuid.uuid4())
    db.add(Photo(
        photo_id=photo_id, task_id=task_id,
        inference={"status": "Fault detected" if ai else "No Fault",
                   "total_detection": len(ai), "detections": ai},
        created_date=datetime.utcnow(),
    ))
    db.commit()
    for r in ai:
        db.add(Detection(
            photo_id=photo_id, task_id=task_id, image_index=r["image_index"],
            x=r["x"], y=r["y"], width=r["width"], height=r["height"],
            faulty_type=r["faulty_type"], confidence_level=r["confidence_level"],
        ))
    db.commit()

    images = sign_image_list(urls)
    risk   = compute_overall_risk(ai)
    return {
        "message": "Task submitted and detection completed",
        "photo_id": photo_id, "overallRisk": risk,
        "detectionResults": [
            {
                "imageUrl": images[i], "side": sides[i], "overallRisk": risk,
                "boundingBoxes": [
                    {"x": r["x"], "y": r["y"], "width": r["width"], "height": r["height"],
                     "faultType": r["faulty_type"], "confidence": r["confidence_level"]}
                    for r in ai if r["image_index"] == i + 1
                ],
            }
            for i in range(4)
        ],
    }


@app.get("/detection/{task_id}")
async def get_detection(task_id: int, db: db_dependency):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    photo = db.query(Photo).filter(Photo.task_id == task_id).first()
    if not photo:
        return []
    boxes  = db.query(Detection).filter(Detection.photo_id == photo.photo_id).all()
    sides  = ["front", "right", "back", "left"]
    images = sign_image_list([task.image_1, task.image_2, task.image_3, task.image_4])
    dets   = [
        {"x": b.x, "y": b.y, "width": b.width, "height": b.height,
         "faulty_type": b.faulty_type, "confidence_level": b.confidence_level,
         "image_index": b.image_index}
        for b in boxes
    ]
    risk = compute_overall_risk(dets)
    return [
        {
            "imageUrl": images[i], "side": sides[i], "overallRisk": risk,
            "boundingBoxes": [
                {"x": d["x"], "y": d["y"], "width": d["width"], "height": d["height"],
                 "faultType": d["faulty_type"], "confidence": d["confidence_level"]}
                for d in dets if d["image_index"] == i + 1
            ],
        }
        for i in range(4)
    ]


@app.put("/tasks/{task_id}/validate")
async def validate_task(task_id: int, data: TaskValidation, db: db_dependency):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    task.validation_status  = data.validation_status
    task.severity_validation = data.severity_validation
    task.cost_estimation    = data.cost_estimation
    task.remarks            = data.remarks
    task.validation_by      = data.validation_by
    task.task_status        = "Validated"
    task.updated_date       = datetime.utcnow()
    db.commit(); db.refresh(task)
    return {"message": "Task validated"}


@app.get("/submissions")
async def get_submissions(db: db_dependency):
    Technician = aliased(User)
    rows = (
        db.query(
            Task.task_id, Task.pillar_id, Task.task_status,
            Task.image_1, Task.image_2, Task.image_3, Task.image_4,
            Task.user_current_location, Task.updated_date,
            Task.validation_status, Task.severity_validation,
            Task.cost_estimation, Task.remarks, Task.validation_by,
            Pillar.address, Pillar.coordinates, Pillar.locality,
            Technician.name.label("technician_name"),
        )
        .outerjoin(Pillar, Pillar.pillarId == Task.pillar_id)
        .outerjoin(Technician, Technician.employeeId == Task.assigned_to)
        .filter(Task.task_status.in_(["Submitted", "Validated", "Completed"]))
        .all()
    )
    result = []
    for r in rows:
        photo = db.query(Photo).filter(Photo.task_id == r.task_id).first()
        boxes = db.query(Detection).filter(Detection.task_id == r.task_id).all()
        dets  = [
            {"x": b.x, "y": b.y, "width": b.width, "height": b.height,
             "faulty_type": b.faulty_type, "confidence_level": b.confidence_level,
             "image_index": b.image_index}
            for b in boxes
        ]
        risk  = compute_overall_risk(dets)
        sides = ["front", "right", "back", "left"]
        imgs  = sign_image_list([r.image_1, r.image_2, r.image_3, r.image_4])
        det_results = [
            {
                "imageUrl": imgs[i], "side": sides[i], "overallRisk": risk,
                "boundingBoxes": [
                    {"x": d["x"], "y": d["y"], "width": d["width"], "height": d["height"],
                     "faultType": d["faulty_type"], "confidence": d["confidence_level"]}
                    for d in dets if d["image_index"] == i + 1
                ],
            }
            for i in range(4)
        ]
        is_validated  = r.validation_status in ("Approved", "Rejected")
        approval_data = (
            {"severity": r.severity_validation, "costEstimation": r.cost_estimation,
             "remarks": r.remarks, "validatedBy": r.validation_by}
            if r.validation_status == "Approved" else None
        )
        result.append({
            "id": photo.photo_id if photo else str(r.task_id),
            "taskId": str(r.task_id), "pillarId": r.pillar_id,
            "location": r.address, "address": r.address, "locality": r.locality,
            "coordinates": r.user_current_location or r.coordinates,
            "images": [{"side": sides[i], "imageUrl": imgs[i]} for i in range(4)],
            "submittedBy": r.technician_name,
            "submittedAt": r.updated_date.isoformat() if r.updated_date else None,
            "detectionStatus": "Completed", "detectionResults": det_results,
            "overallRisk": risk, "validationStatus": r.validation_status or "Pending",
            "sentToSupervisor": True, "validated": is_validated, "approvalData": approval_data,
        })
    return result


@app.put("/tasks/{task_id}/maintenance")
async def update_maintenance(task_id: int, data: TaskMaintenance, db: db_dependency):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    raw  = task.work_log
    logs = raw if isinstance(raw, list) else ([raw] if isinstance(raw, dict) else [])
    uploaded = [
        upload_image_to_gcs(img, f"maintenance/task_{task_id}_worklog_{uuid.uuid4().hex[:8]}.jpg")
        for img in (data.images or [])
    ]
    logs.append({
        "action": data.action, "notes": data.notes, "images": uploaded,
        "logged_by": data.logged_by,
        "logged_by_name": db.query(User.name).filter(User.employeeId == data.logged_by).scalar(),
        "timestamp": datetime.utcnow().isoformat(),
    })
    task.work_log           = logs
    task.maintenance_status = data.maintenance_status
    task.logged_by          = data.logged_by
    if data.completion_evidence:
        task.completion_evidence = upload_image_to_gcs(
            data.completion_evidence,
            f"maintenance/task_{task_id}_completion_{uuid.uuid4().hex[:8]}.jpg",
        )
    if data.maintenance_validate_by:
        task.maintenance_validate_by = data.maintenance_validate_by
    if data.maintenance_status == "Completed":
        task.task_status = "Completed"
    task.updated_date = datetime.utcnow()
    db.commit(); db.refresh(task)
    return {"message": "Maintenance updated", "task_id": task_id,
            "maintenance_status": task.maintenance_status, "work_log": task.work_log}


@app.get("/maintenance")
async def get_maintenance(db: db_dependency):
    Technician = aliased(User)
    rows = (
        db.query(
            Task.task_id, Task.pillar_id, Task.task_status, Task.maintenance_status,
            Task.severity_validation, Task.cost_estimation, Task.remarks, Task.work_log,
            Task.due_date, Task.updated_date,
            Task.image_1, Task.image_2, Task.image_3, Task.image_4,
            Task.user_current_location, Pillar.address, Pillar.coordinates,
            Technician.name.label("technician_name"),
        )
        .outerjoin(Pillar, Pillar.pillarId == Task.pillar_id)
        .outerjoin(Technician, Technician.employeeId == Task.assigned_to)
        .filter(Task.validation_status == "Approved")
        .all()
    )
    result = []
    for r in rows:
        boxes = db.query(Detection).filter(Detection.task_id == r.task_id).all()
        faults = list(set(b.faulty_type for b in boxes))
        sides  = ["front", "right", "back", "left"]
        imgs   = sign_image_list([r.image_1, r.image_2, r.image_3, r.image_4])
        prev_dets = [
            {
                "side": sides[i], "imageUrl": imgs[i],
                "boundingBoxes": [
                    {"x": b.x, "y": b.y, "width": b.width, "height": b.height,
                     "faultType": b.faulty_type, "confidence": b.confidence_level}
                    for b in boxes if b.image_index == i + 1
                ],
            }
            for i in range(4) if imgs[i]
        ]
        result.append({
            "id": str(r.task_id), "taskId": str(r.task_id), "pillarId": r.pillar_id,
            "address": r.address, "coordinates": r.user_current_location or r.coordinates,
            "severity": r.severity_validation, "estimatedCost": r.cost_estimation or 0,
            "notes": r.remarks, "faults": faults, "status": r.maintenance_status or "Pending",
            "workLogs": [
                {**log, "images": sign_image_list(log.get("images") or [])}
                for log in (r.work_log or [])
            ],
            "assignedTo": r.technician_name,
            "scheduledDate": r.due_date.isoformat() if r.due_date else None,
            "createdAt": r.updated_date.isoformat() if r.updated_date else None,
            "previousDetections": prev_dets,
        })
    return result


# ---------------------------------------------------------------------------
# Analytics insights
# ---------------------------------------------------------------------------

@app.get("/analytics/insights")
async def get_analytics_insights(db: db_dependency):
    """
    AI-generated report via LangChain + Gemini structured output.
    Covers: executive insight, risk level, 6-month cost projection,
    per-severity analysis, per-fault-type analysis, recommendations.
    """
    stats = _aggregate_stats(db)
    try:
        report: AnalyticsInsightsReport = await _analytics_chain.ainvoke(
            {"stats": json.dumps(stats, indent=2, ensure_ascii=False)}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI report generation failed: {str(e)[:400]}",
        )
    return {
        "stats":             stats,
        "insight":           report.insight,
        "riskLevel":         report.risk_level,
        "potentialSavings":  report.potential_savings,
        "costProjection":    [m.model_dump() for m in report.cost_projection],
        "severityInsights":  [s.model_dump() for s in report.severity_insights],
        "severitySummary":   report.severity_summary,
        "faultTypeInsights": [f.model_dump() for f in report.fault_type_insights],
        "faultSummary":      report.fault_summary,
        "recommendations":   report.recommendations,
    }