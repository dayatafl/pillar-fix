from dotenv import load_dotenv
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
import asyncio
import httpx
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=engine)

INFERENCE_URL = "https://pillarfix-inference-ftvjv.ondigitalocean.app/inspect"

# Historical yearly actuals — 2023-2025 only. 2026 comes from live DB.
HISTORICAL_YEARLY_COSTS = {
    "2023": 446250.0,
    "2024": 637500.0,
    "2025": 765000.0,
}


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
# Analytics output schemas
# ---------------------------------------------------------------------------

class YearProjection(BaseModel):
    year: str         = Field(description="4-digit year string e.g. '2027'")
    projected: float  = Field(description="Projected reactive maintenance cost in RM")
    preventive: float = Field(description="Estimated cost with preventive maintenance adopted (RM)")


class SeverityInsight(BaseModel):
    level: str        = Field(description="Severity level: Critical | High | Medium | Low")
    count: int        = Field(description="Number of pillars at this severity level")
    percentage: float = Field(description="Percentage share of total pillars (0-100)")
    analysis: str     = Field(description="1-2 sentence analysis of this severity tier's structural and maintenance implications only. Do NOT mention specific localities, area names, or place names.")
    urgency: str      = Field(description="Recommended response timeframe e.g. Within 24 hours")


class FaultTypeInsight(BaseModel):
    fault_type: str        = Field(description="Fault name e.g. Crack, Rust, Spalling")
    occurrences: int       = Field(description="Total AI detections of this fault type")
    avg_confidence: float  = Field(description="Mean AI detection confidence 0.0-1.0")
    risk_contribution: str = Field(description="Low | Medium | High")
    recommendation: str    = Field(description="Specific actionable maintenance recommendation")


class LocalityCostBreakdown(BaseModel):
    locality: str          = Field(description="Area or locality name")
    total_cost: float      = Field(description="Total maintenance cost in RM for this locality")
    task_count: int        = Field(description="Number of approved tasks in this locality")
    avg_cost: float        = Field(description="Average cost per task in RM for this locality")
    cost_share: float      = Field(description="Percentage share of total portfolio cost (0-100)")
    assessment: str        = Field(description="1 sentence assessment of cost efficiency or concern for this area")


class CostAnalysis(BaseModel):
    total_spent: float            = Field(description="Total RM spent on approved maintenance tasks")
    avg_cost_per_task: float      = Field(description="Average cost per maintenance task in RM")
    most_expensive_locality: str  = Field(description="Locality with highest total maintenance cost")
    cost_trend: str               = Field(description="Rising | Stable | Declining — based on yearly cost data")
    cost_trend_explanation: str   = Field(description="1-2 sentences explaining the cost trend with reference to actual yearly figures")
    locality_breakdown: list[LocalityCostBreakdown] = Field(
        description="Cost breakdown per locality, sorted by total_cost descending. If no locality data, return one entry with locality=Unknown."
    )
    cost_efficiency_rating: str       = Field(description="Poor | Fair | Good | Excellent — overall cost management rating with brief justification in parentheses")
    six_month_projected_total: float  = Field(description="Sum of all projected costs over the 4-year projection window in RM")
    six_month_preventive_total: float = Field(description="Sum of all preventive costs over the 4-year projection window in RM")
    cost_summary: str                 = Field(description="2-3 sentence narrative summarising cost health, biggest cost drivers, and financial outlook")


class AnalyticsInsightsReport(BaseModel):
    insight: str               = Field(description="2-3 sentence executive summary of overall maintenance health")
    risk_level: str            = Field(description="Overall portfolio risk: Low | Medium | High | Critical")
    potential_savings: float   = Field(description="Total RM savings over 4-year projection by adopting preventive maintenance")
    cost_projection: list[YearProjection] = Field(description="Exactly 4 yearly cost projections for years 2027, 2028, 2029, 2030")
    cost_analysis: CostAnalysis                 = Field(description="Deep cost analysis covering spend, trends, locality breakdown, and efficiency")
    severity_insights: list[SeverityInsight]    = Field(description="One entry per severity level present in the data")
    severity_summary: str                       = Field(description="1-2 sentence overall severity portfolio assessment")
    fault_type_insights: list[FaultTypeInsight] = Field(description="One entry per fault type sorted by occurrences descending")
    fault_summary: str         = Field(description="1-2 sentence summary of dominant fault patterns")
    recommendations: list[str] = Field(description="Exactly 3 specific actionable recommendations")


# ---------------------------------------------------------------------------
# LangChain chain with Gemini
# ---------------------------------------------------------------------------

_SYSTEM_INSTRUCTION = """You are a senior infrastructure analytics specialist for a Malaysian utility
company managing roadside utility pillars (concrete/metal posts).

You MUST populate ALL 10 fields of the AnalyticsInsightsReport — never omit any field.
If data is sparse, use reasonable estimates and note it in the analysis text.

COST PROJECTION (cost_projection) — required, exactly 4 entries for years 2027, 2028, 2029, 2030.
Historical actuals: 2023=RM446,250 | 2024=RM637,500 | 2025=RM765,000 | 2026=total_cost_rm from stats.
Use the pre-computed projection_years list from stats — copy those values directly into cost_projection.
Do NOT recalculate. Return year as a string: "2027", "2028", "2029", "2030".

COST ANALYSIS (cost_analysis) — required, full deep analysis
- total_spent: use total_cost_rm from stats.
- avg_cost_per_task: use avg_cost_per_task_rm from stats.
- most_expensive_locality: locality with highest total_cost in locality_breakdown.
  If locality_breakdown is empty, write "Insufficient data".
- cost_trend: compare yearly_costs values chronologically (2023→2024→2025→2026).
  Rising = costs clearly increasing. Declining = clearly decreasing. Stable = roughly flat.
- cost_trend_explanation: reference actual year names and RM figures from yearly_costs in stats.
- locality_breakdown: one entry per locality in locality_breakdown dict.
  total_cost, task_count = locality_breakdown[loc].total_cost / .count
  avg_cost = total_cost / task_count
  cost_share = (total_cost / total_cost_rm) x 100
  If locality_breakdown is empty: one entry locality=Unknown, zeros, assessment="No locality data recorded yet".
- cost_efficiency_rating:
  Excellent = avg below RM 3000/task AND declining trend.
  Good = avg RM 3000-6000/task.
  Fair = avg RM 6000-10000/task or rising trend.
  Poor = avg above RM 10000/task or all reactive.
  Include justification in parentheses.
- six_month_projected_total: use projected_4yr_total from stats.
- six_month_preventive_total: use preventive_4yr_total from stats.
- cost_summary: 2-3 sentences on total spend, biggest cost driver, and financial outlook.
  Always mention saving_rate_pct and saving_rate_source from stats.

SEVERITY INSIGHTS — Focus strictly on structural/maintenance implications of this severity level. Never reference specific localities, area names, or place names. Keep it tier-focused only.
If empty, produce one placeholder entry.
percentage = (count / total_approved_tasks) x 100, 1 decimal.
Urgency: Critical=Within 24-48 hours, High=Within 1 week, Medium=Within 1 month, Low=Scheduled next quarter.

FAULT TYPE INSIGHTS — one entry per fault in fault_type_frequency, sorted by occurrences descending.
If empty, produce one placeholder entry.
risk_contribution: High = avg_confidence > 0.85 AND occurrences >= 3; Medium = occurrences >= 2; Low = otherwise.
recommendation must name a specific maintenance action.

RECOMMENDATIONS — exactly 3 strings.
At least one must reference a cost-saving action with an RM figure.
At least one must reference a specific fault type.
At least one must reference a specific locality or severity level.

severity_summary and fault_summary — always non-empty strings.
All RM figures must be realistic for Malaysian infrastructure (typical range RM 2000-15000/task)."""


def _build_analytics_chain():
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=os.environ.get("GEMINI_API_KEY"),
        max_output_tokens=6000,
        temperature=0,
        convert_system_message_to_human=True,
    )
    structured_llm = llm.with_structured_output(AnalyticsInsightsReport)
    prompt = ChatPromptTemplate.from_messages([
        ("system", _SYSTEM_INSTRUCTION),
        ("human", "Aggregated maintenance statistics:\n\n{stats}\n\nGenerate the complete analytics report. All 10 fields are required."),
    ])
    return prompt | structured_llm


_analytics_chain = _build_analytics_chain()


# ---------------------------------------------------------------------------
# Shared projection helper — used by both chart-data and _aggregate_stats
# ---------------------------------------------------------------------------

def _compute_projections(total_cost_2026: float, saving_rate: float) -> tuple[list[dict], float]:
    """
    Compute 2027-2030 projections from historical data only (2023-2025).
    2026 live data is used as base year for projection but NOT for trend calculation.
    Returns (projection_years, trend_multiplier).
    projection_years = [{"year": "2027", "projected": x, "preventive": y}, ...]
    """
    # Calculate trend from historical data only (2023-2025), not including live 2026
    hist_values = [
        HISTORICAL_YEARLY_COSTS["2023"],
        HISTORICAL_YEARLY_COSTS["2024"],
        HISTORICAL_YEARLY_COSTS["2025"],
    ]
    valid_hist = [v for v in hist_values if v > 0]
    if len(valid_hist) >= 2:
        raw_growth       = (valid_hist[-1] / valid_hist[0]) ** (1 / (len(valid_hist) - 1))
        trend_multiplier = max(1.03, min(1.12, raw_growth))
    else:
        trend_multiplier = 1.06

    # Base is 2026 actual; project forward from there using historical trend
    base = total_cost_2026 if total_cost_2026 > 0 else HISTORICAL_YEARLY_COSTS["2025"]
    projection_years = []
    for i, yr in enumerate(["2027", "2028", "2029", "2030"]):
        projected  = round(base * (trend_multiplier ** (i + 1)), 2)
        preventive = round(projected * (1 - saving_rate), 2)
        projection_years.append({"year": yr, "projected": projected, "preventive": preventive})

    return projection_years, trend_multiplier


def _compute_saving_rate(approved_tasks: list) -> tuple[float, str]:
    """Derive saving rate from completed task data, falling back to industry default."""
    INDUSTRY_DEFAULT = 0.35
    MIN_TASKS        = 20

    completed     = [t for t in approved_tasks if t.task_status == "Completed" and t.cost_estimation is not None]
    preventive_px = [t for t in completed if t.severity_validation in ("Low", "Medium")]
    reactive_px   = [t for t in completed if t.severity_validation in ("High", "Critical")]

    avg_p = (sum(t.cost_estimation for t in preventive_px) / len(preventive_px)) if preventive_px else None
    avg_r = (sum(t.cost_estimation for t in reactive_px)   / len(reactive_px))   if reactive_px   else None

    if avg_p is not None and avg_r is not None and avg_r > 0:
        raw_rate   = max(0.0, min(0.70, 1.0 - (avg_p / avg_r)))
        confidence = min(1.0, len(completed) / MIN_TASKS)
        rate       = (confidence * raw_rate) + ((1 - confidence) * INDUSTRY_DEFAULT)
        source     = (
            f"derived ({len(completed)} completed tasks, {round(confidence*100)}% confidence, "
            f"blended with {round((1-confidence)*100)}% industry default)"
        )
    else:
        rate = INDUSTRY_DEFAULT
        n    = len(completed)
        if n == 0:
            source = "industry default (no completed tasks yet)"
        elif not preventive_px:
            source = f"industry default (no Low/Medium completed tasks yet — {n} High/Critical only)"
        elif not reactive_px:
            source = f"industry default (no High/Critical completed tasks yet — {n} Low/Medium only)"
        else:
            source = "industry default (fallback)"

    return rate, source


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

    avg_confidence = (
        sum(d.confidence_level for d in all_detections) / len(all_detections)
        if all_detections else 0.0
    )

    saving_rate, saving_rate_source = _compute_saving_rate(approved_tasks)

    # Yearly cost series — 2026 is live from DB
    yearly_costs = {**HISTORICAL_YEARLY_COSTS, "2026": round(total_cost, 2)}

    # 2027-2030 projections only
    projection_years, trend_multiplier = _compute_projections(total_cost, saving_rate)

    projected_4yr_total  = round(sum(p["projected"]  for p in projection_years), 2)
    preventive_4yr_total = round(sum(p["preventive"] for p in projection_years), 2)
    potential_savings    = round(projected_4yr_total - preventive_4yr_total, 2)

    completed_tasks  = [t for t in approved_tasks if t.task_status == "Completed" and t.cost_estimation is not None]
    preventive_proxy = [t for t in completed_tasks if t.severity_validation in ("Low", "Medium")]
    reactive_proxy   = [t for t in completed_tasks if t.severity_validation in ("High", "Critical")]
    avg_preventive_cost = (sum(t.cost_estimation for t in preventive_proxy) / len(preventive_proxy)) if preventive_proxy else None
    avg_reactive_cost   = (sum(t.cost_estimation for t in reactive_proxy)   / len(reactive_proxy))   if reactive_proxy   else None

    return {
        "snapshot_date":               datetime.utcnow().strftime("%Y-%m-%d"),
        "total_approved_tasks":        len(approved_tasks),
        "total_cost_rm":               round(total_cost, 2),
        "avg_cost_per_task_rm":        round(avg_cost, 2),
        "completed_maintenance":       completed_count,
        "in_progress_maintenance":     in_progress,
        "pending_maintenance":         pending,
        "severity_distribution":       severity_counts,
        "fault_type_frequency":        fault_freq,
        "fault_type_avg_confidence":   fault_avg_confidence,
        "locality_breakdown":          locality_stats,
        "ai_avg_detection_confidence": round(avg_confidence, 3),
        "total_detections":            len(all_detections),
        "yearly_costs":                yearly_costs,
        "projection_years":            projection_years,
        "projected_4yr_total":         projected_4yr_total,
        "preventive_4yr_total":        preventive_4yr_total,
        "potential_savings":           potential_savings,
        "potential_savings_6mo":       round(sum(p["projected"] - p["preventive"] for p in projection_years[:2]), 2),
        "trend_multiplier":            round(trend_multiplier, 4),
        "saving_rate":                 round(saving_rate, 4),
        "saving_rate_pct":             round(saving_rate * 100, 1),
        "saving_rate_source":          saving_rate_source,
        "avg_preventive_proxy_cost":   round(avg_preventive_cost, 2) if avg_preventive_cost else None,
        "avg_reactive_proxy_cost":     round(avg_reactive_cost, 2)   if avg_reactive_cost   else None,
        "preventive_proxy_count":      len(preventive_proxy),
        "reactive_proxy_count":        len(reactive_proxy),
    }


# ---------------------------------------------------------------------------
# Inference API integration
# ---------------------------------------------------------------------------

async def _call_inference_api(image_url: str) -> dict:
    """Download image from signed GCS URL, POST to inference API as multipart."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        img_resp = await client.get(image_url)
        img_resp.raise_for_status()
        files = {"file": ("image.jpg", img_resp.content, "image/jpeg")}
        infer_resp = await client.post(INFERENCE_URL, files=files)
        infer_resp.raise_for_status()
        return infer_resp.json()


def _parse_inference_result(result: dict, image_index: int) -> tuple[list[dict], float]:
    """Map inference API predictions to Detection model fields. Skips Feeder Pillar wrapper.
    Returns (detections, total_estimated_cost_rm) for this image."""
    detections = []
    for pred in result.get("predictions", []):
        if pred.get("class") == "Feeder Pillar":
            continue
        detections.append({
            "image_index":      image_index,
            "faulty_type":      pred["class"],
            "confidence_level": pred["confidence"],
            "x":                pred["x"],
            "y":                pred["y"],
            "width":            pred["width"],
            "height":           pred["height"],
        })
    cost = float(result.get("total_estimated_cost_rm") or 0.0)
    return detections, cost


async def _run_inference_on_images(signed_urls: list[str]) -> tuple[list[dict], float]:
    """Run inference on all images concurrently. Failed images are logged and skipped.
    Returns (detections, total_estimated_cost_rm) summed across all images."""
    results = await asyncio.gather(
        *[_call_inference_api(url) for url in signed_urls],
        return_exceptions=True,
    )
    detections: list[dict] = []
    total_cost: float = 0.0
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"[inference] image {i + 1} failed: {result}")
            continue
        image_detections, image_cost = _parse_inference_result(result, image_index=i + 1)
        detections.extend(image_detections)
        total_cost += image_cost
    return detections, round(total_cost, 2)


def _persist_detections(db: Session, photo_id: str, task_id: int, detections: list[dict]) -> None:
    for d in detections:
        db.add(Detection(
            photo_id=photo_id, task_id=task_id,
            image_index=d["image_index"],
            x=d["x"], y=d["y"], width=d["width"], height=d["height"],
            faulty_type=d["faulty_type"], confidence_level=d["confidence_level"],
        ))
    db.commit()


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
    
    if not user.isActive:
        raise HTTPException(403, "This account has been deactivated. Please contact your administrator.")
    
    return {
        "exists": True,
        "user": {
            "id": user.id, "name": user.name, "email": user.email,
            "username": user.username, "employeeId": user.employeeId,
            "role": user.role, "isActive": user.isActive, "locality": user.locality,
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
    return {"id": str(u.id), "isActive": u.isActive,
            "message": f"User {'activated' if u.isActive else 'deactivated'}"}


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
    task.assigned_to  = tech.employeeId
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

    gcs_urls = [
        upload_image_to_gcs(img, f"audit/task_{task_id}_{sides[i]}_{uuid.uuid4().hex[:8]}.jpg")
        for i, img in enumerate(raw)
    ]
    task.image_1 = gcs_urls[0]; task.image_2 = gcs_urls[1]
    task.image_3 = gcs_urls[2]; task.image_4 = gcs_urls[3]
    task.user_current_location = data.user_current_location
    task.task_status  = "Submitted"
    task.updated_date = datetime.utcnow()
    db.commit()

    signed_urls = sign_image_list(gcs_urls)
    detections, total_estimated_cost = await _run_inference_on_images(signed_urls)

    photo_id = str(uuid.uuid4())
    db.add(Photo(
        photo_id=photo_id, task_id=task_id,
        inference={
            "status": "Fault detected" if detections else "No Fault",
            "total_detection": len(detections),
            "detections": detections,
            "total_estimated_cost_rm": total_estimated_cost,
        },
        created_date=datetime.utcnow(),
    ))
    db.commit()
    _persist_detections(db, photo_id, task_id, detections)

    risk = compute_overall_risk(detections)
    return {
        "message": "Task submitted and detection completed",
        "photo_id": photo_id,
        "overallRisk": risk,
        "estimatedCost": total_estimated_cost,
        "detectionResults": [
            {
                "imageUrl": signed_urls[i], "side": sides[i], "overallRisk": risk,
                "boundingBoxes": [
                    {"x": d["x"], "y": d["y"], "width": d["width"], "height": d["height"],
                     "faultType": d["faulty_type"], "confidence": d["confidence_level"]}
                    for d in detections if d["image_index"] == i + 1
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

    sides    = ["front", "right", "back", "left"]
    gcs_urls = [task.image_1, task.image_2, task.image_3, task.image_4]
    images   = sign_image_list(gcs_urls)

    existing_boxes = db.query(Detection).filter(Detection.photo_id == photo.photo_id).all()
    if existing_boxes:
        boxes = existing_boxes
    else:
        detections, _ = await _run_inference_on_images(images)
        _persist_detections(db, photo.photo_id, task_id, detections)
        boxes = db.query(Detection).filter(Detection.photo_id == photo.photo_id).all()

    dets = [
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
    task.validation_status   = data.validation_status
    task.severity_validation = data.severity_validation
    task.cost_estimation     = data.cost_estimation
    task.remarks             = data.remarks
    task.validation_by       = data.validation_by
    task.task_status         = "Validated"
    task.updated_date        = datetime.utcnow()
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
            "estimatedCost": (photo.inference or {}).get("total_estimated_cost_rm") if photo else None,
        })
    return result


@app.put("/tasks/{task_id}/maintenance")
async def update_maintenance(task_id: int, data: TaskMaintenance, db: db_dependency):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    raw      = task.work_log
    existing = raw if isinstance(raw, list) else ([raw] if isinstance(raw, dict) else [])
    uploaded = [
        upload_image_to_gcs(img, f"maintenance/task_{task_id}_worklog_{uuid.uuid4().hex[:8]}.jpg")
        for img in (data.images or [])
    ]
    new_entry = {
        "id": uuid.uuid4().hex,
        "action": data.action, "notes": data.notes, "images": uploaded,
        "logged_by": data.logged_by,
        "logged_by_name": db.query(User.name).filter(User.employeeId == data.logged_by).scalar(),
        "timestamp": datetime.utcnow().isoformat(),
    }
    task.work_log           = [*existing, new_entry]
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
        boxes  = db.query(Detection).filter(Detection.task_id == r.task_id).all()
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
# Analytics
# ---------------------------------------------------------------------------

@app.get("/analytics/chart-data")
async def get_analytics_chart_data(db: db_dependency):
    """
    Returns the full 8-point yearly chart (2023-2030) immediately with no AI call.
    Historical actuals are 2023-2026. Projections for 2027-2030 are computed
    from the historical trend so the chart is fully populated without waiting for AI.
    """
    approved_tasks  = db.query(Task).filter(Task.validation_status == "Approved").all()
    total_cost_2026 = round(sum(t.cost_estimation or 0 for t in approved_tasks), 2)

    saving_rate, _ = _compute_saving_rate(approved_tasks)
    projection_years, _ = _compute_projections(total_cost_2026, saving_rate)
    proj_lookup = {p["year"]: p for p in projection_years}

    historical = [
        ("2023", HISTORICAL_YEARLY_COSTS["2023"], True),
        ("2024", HISTORICAL_YEARLY_COSTS["2024"], True),
        ("2025", HISTORICAL_YEARLY_COSTS["2025"], True),
        ("2026", total_cost_2026,                 False),
    ]
    chart = [
        {
            "year":       yr,
            "actual":     actual,
            "projected":  actual,
            "preventive": round(actual * (1 - saving_rate), 2),
            "is_mock":    is_mock,
        }
        for yr, actual, is_mock in historical
    ]
    for yr in ["2027", "2028", "2029", "2030"]:
        p = proj_lookup[yr]
        chart.append({
            "year":       yr,
            "actual":     None,
            "projected":  p["projected"],
            "preventive": p["preventive"],
            "is_mock":    False,
        })

    return {"chart": chart, "total_cost_2026": total_cost_2026}


# ---------------------------------------------------------------------------
# Insights cache + builder
# ---------------------------------------------------------------------------

_insights_cache: dict | None = None


def _build_insights_response(stats: dict, report: AnalyticsInsightsReport) -> dict:
    saving_rate      = stats.get("saving_rate", 0.35)
    total_cost_2026  = stats.get("total_cost_rm", 0)

    proj_lookup = {entry.year: entry for entry in report.cost_projection}

    historical = [
        ("2023", HISTORICAL_YEARLY_COSTS["2023"], True),
        ("2024", HISTORICAL_YEARLY_COSTS["2024"], True),
        ("2025", HISTORICAL_YEARLY_COSTS["2025"], True),
        ("2026", total_cost_2026,                 False),
    ]

    chart_series = []
    for yr, actual, is_mock in historical:
        chart_series.append({
            "year":       yr,
            "actual":     actual,
            "projected":  actual,
            "preventive": round(actual * (1 - saving_rate), 2),
            "is_mock":    is_mock,
        })

    for yr in ["2027", "2028", "2029", "2030"]:
        entry = proj_lookup.get(yr)
        chart_series.append({
            "year":       yr,
            "actual":     None,
            "projected":  entry.projected  if entry else None,
            "preventive": entry.preventive if entry else None,
            "is_mock":    False,
        })

    # Potential savings only from future projection years (2027-2030)
    potential_savings = round(sum(
        (e["projected"] or 0) - (e["preventive"] or 0)
        for e in chart_series if e["actual"] is None and e["projected"] is not None
    ), 2)

    return {
        "stats":             stats,
        "insight":           report.insight,
        "riskLevel":         report.risk_level,
        "potentialSavings":  potential_savings,
        "costProjection":    chart_series,
        "costAnalysis":      report.cost_analysis.model_dump(),
        "severityInsights":  [s.model_dump() for s in report.severity_insights],
        "severitySummary":   report.severity_summary,
        "faultTypeInsights": [f.model_dump() for f in report.fault_type_insights],
        "faultSummary":      report.fault_summary,
        "recommendations":   report.recommendations,
    }


@app.get("/analytics/insights")
async def get_analytics_insights(db: db_dependency, refresh: bool = False):
    """
    Returns cached AI analytics report. Pass ?refresh=true to force regeneration.
    On first call (cache is empty) always generates — no manual trigger needed.
    """
    global _insights_cache

    if _insights_cache is not None and not refresh:
        return _insights_cache

    stats = _aggregate_stats(db)
    try:
        report: AnalyticsInsightsReport = await _analytics_chain.ainvoke(
            {"stats": json.dumps(stats, indent=2, ensure_ascii=False)}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI report generation failed: {str(e)[:400]}")

    _insights_cache = _build_insights_response(stats, report)
    return _insights_cache
