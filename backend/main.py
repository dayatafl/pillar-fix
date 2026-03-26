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


class LocalityCostBreakdown(BaseModel):
    locality: str         = Field(description="Area or locality name")
    total_cost: float     = Field(description="Total maintenance cost in RM for this locality")
    task_count: int       = Field(description="Number of approved tasks in this locality")
    avg_cost: float       = Field(description="Average cost per task in RM for this locality")
    cost_share: float     = Field(description="Percentage share of total portfolio cost (0-100)")
    assessment: str       = Field(description="1 sentence assessment of cost efficiency or concern for this area")


class CostAnalysis(BaseModel):
    total_spent: float          = Field(description="Total RM spent on approved maintenance tasks")
    avg_cost_per_task: float    = Field(description="Average cost per maintenance task in RM")
    most_expensive_locality: str = Field(description="Locality with highest total maintenance cost")
    cost_trend: str             = Field(description="Rising | Stable | Declining — based on monthly cost data")
    cost_trend_explanation: str = Field(description="1-2 sentences explaining the cost trend with reference to actual monthly figures")
    locality_breakdown: list[LocalityCostBreakdown] = Field(
        description="Cost breakdown per locality, sorted by total_cost descending. If no locality data, return one entry with locality=Unknown."
    )
    cost_efficiency_rating: str = Field(description="Poor | Fair | Good | Excellent — overall cost management rating with brief justification in parentheses")
    six_month_projected_total: float = Field(description="Sum of all projected costs over the 6-month window in RM")
    six_month_preventive_total: float = Field(description="Sum of all preventive costs over the 6-month window in RM")
    cost_summary: str           = Field(description="2-3 sentence narrative summarising cost health, biggest cost drivers, and financial outlook")


class AnalyticsInsightsReport(BaseModel):
    insight: str               = Field(description="2-3 sentence executive summary of overall maintenance health")
    risk_level: str            = Field(description="Overall portfolio risk: Low | Medium | High | Critical")
    potential_savings: float   = Field(description="Total RM savings over 6 months by adopting preventive maintenance")
    cost_projection: list[MonthProjection]      = Field(description="Exactly 6 monthly cost projections starting from next_projection_month")
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

COST PROJECTION (cost_projection) — required, exactly 6 entries
IMPORTANT: The stats already contain a pre-computed "projection_months" list with 6 entries,
each having: month, projected, preventive. These values already incorporate Malaysian seasonal
factors and observed cost trends. You MUST copy these values directly into cost_projection —
do NOT recalculate or invent new numbers.
Example: if projection_months = [{{"month":"Apr","projected":5200,"preventive":3380}}, ...]
then cost_projection must be exactly those 6 entries.

COST ANALYSIS (cost_analysis) — required, full deep analysis
- total_spent: use total_cost_rm from stats.
- avg_cost_per_task: use avg_cost_per_task_rm from stats.
- potential_savings: use potential_savings_6mo from stats.
- most_expensive_locality: locality with highest total_cost in locality_breakdown.
  If locality_breakdown is empty, write "Insufficient data".
- cost_trend: compare monthly_costs_this_year values chronologically.
  Rising = costs clearly increasing month over month.
  Declining = costs clearly decreasing.
  Stable = roughly flat OR only 1 month of data available.
  Use trend_multiplier hint: > 1.03 = Rising, < 0.97 = Declining, else Stable.
- cost_trend_explanation: reference actual month names and RM figures from monthly_costs_this_year.
  If only 1 month exists, say so explicitly and note trend cannot yet be determined.
- locality_breakdown: one entry per locality in locality_breakdown dict.
  total_cost = locality_breakdown[loc].total_cost
  task_count = locality_breakdown[loc].count
  avg_cost = total_cost / task_count
  cost_share = (total_cost / total_cost_rm) x 100
  assessment: 1 sentence — is avg_cost above/below portfolio average?
  Any critical faults driving cost?
  If locality_breakdown is empty: one entry locality=Unknown, zeros,
  assessment="No locality data recorded yet".
- cost_efficiency_rating: rate overall cost management.
  Excellent = avg below RM 3000/task AND declining trend.
  Good = avg RM 3000-6000/task (Malaysian benchmark range).
  Fair = avg RM 6000-10000/task or rising trend.
  Poor = avg above RM 10000/task or all reactive.
  Include justification in parentheses.
- six_month_projected_total: use projected_6mo_total from stats.
- six_month_preventive_total: use preventive_6mo_total from stats.
- cost_summary: 2-3 sentences on total spend, biggest cost driver, and financial outlook.
  IMPORTANT: Always mention the saving_rate_pct and saving_rate_source from stats in the
  cost_summary. e.g. "The projected saving rate of X% is [derived from Y completed tasks /
  based on industry default]." This tells managers how reliable the saving estimate is.

SEVERITY INSIGHTS (severity_insights) — required, one entry per level in severity_distribution
- If empty, produce one placeholder entry.
- percentage = (count / total_approved_tasks) x 100, 1 decimal.
- Urgency: Critical=Within 24-48 hours, High=Within 1 week,
           Medium=Within 1 month, Low=Scheduled next quarter.

FAULT TYPE INSIGHTS (fault_type_insights) — required, one entry per fault in fault_type_frequency
- If empty, produce one placeholder entry.
- Sort by occurrences descending.
- risk_contribution: High = avg_confidence > 0.85 AND occurrences >= 3;
                     Medium = occurrences >= 2; Low = otherwise.
- recommendation must name a specific maintenance action.

RECOMMENDATIONS (recommendations) — required, exactly 3 strings.
- At least one must reference a cost-saving action with an RM figure.
- At least one must reference a specific fault type.
- At least one must reference a specific locality or severity level.

severity_summary and fault_summary — required, always non-empty strings.
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
        (
            "system",
            _SYSTEM_INSTRUCTION,
        ),
        (
            "human",
            "Aggregated maintenance statistics:\n\n{stats}\n\nGenerate the complete analytics report. All 10 fields are required.",
        ),
    ])

    return prompt | structured_llm


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

    # Locality breakdown with cost detail
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

    # ── Monthly trends (real DB data + mock for missing prior months) ──────────
    now        = datetime.utcnow()
    year_start = datetime(now.year, 1, 1)
    monthly_tasks = db.query(Task).filter(Task.created_date >= year_start).all()

    MONTH_ORDER = ["Jan","Feb","Mar","Apr","May","Jun",
                   "Jul","Aug","Sep","Oct","Nov","Dec"]

    # Real monthly data from DB
    monthly_counts: dict[str, int]   = {}
    monthly_costs:  dict[str, float] = {}
    for t in monthly_tasks:
        if t.created_date:
            key = t.created_date.strftime("%b")
            monthly_counts[key] = monthly_counts.get(key, 0) + 1
            monthly_costs[key]  = monthly_costs.get(key, 0) + (t.cost_estimation or 0)

    # ── Mock data for months with no real tasks yet ──────────────────────────
    # Fills in the months from Jan up to (but not including) the current month
    # so the chart always has a full historical line to anchor the projection.
    # Uses avg_cost as the base with Malaysian seasonal variation and mild noise.
    # REMOVE THIS BLOCK once you have 6+ months of real task data.
    import random
    random.seed(42)  # fixed seed so mock data is stable across reloads

    SEASONAL_MOCK = {
        "Jan": 0.82, "Feb": 0.88, "Mar": 0.95, "Apr": 1.05,
        "May": 1.12, "Jun": 1.18, "Jul": 1.10, "Aug": 1.03,
        "Sep": 0.98, "Oct": 0.93, "Nov": 0.84, "Dec": 0.78,
    }

    mock_base = avg_cost if avg_cost > 0 else 5000.0
    for m_idx in range(now.month - 1):   # all months before current month
        month_abbr = MONTH_ORDER[m_idx]
        if month_abbr not in monthly_costs:   # only fill if no real data exists
            seasonal_factor = SEASONAL_MOCK[month_abbr]
            noise           = random.uniform(0.88, 1.12)
            mock_cost       = round(mock_base * seasonal_factor * noise, 2)
            mock_count      = max(1, round(mock_base / 5000))  # approx task count
            monthly_costs[month_abbr]  = mock_cost
            monthly_counts[month_abbr] = mock_count
    # ── End mock data block ──────────────────────────────────────────────────

    avg_confidence = (
        sum(d.confidence_level for d in all_detections) / len(all_detections)
        if all_detections else 0.0
    )

    next_month = (
        datetime(now.year + 1, 1, 1) if now.month == 12
        else datetime(now.year, now.month + 1, 1)
    ).strftime("%b")

    # Months elapsed so far this year (min 1 to avoid division by zero)
    months_elapsed = max(1, now.month)

    # ── Option 3: Derive saving rate from your own completed task data ─────────
    #
    # Logic:
    #   - "Preventive proxy" = completed tasks with Low or Medium severity.
    #     These were caught early with minimal damage — similar to what a
    #     scheduled preventive inspection would find and fix.
    #   - "Reactive proxy" = completed tasks with High or Critical severity.
    #     These escalated before being caught — the expensive reactive pattern.
    #   - saving_rate = 1 - (avg_preventive_cost / avg_reactive_cost)
    #     e.g. if preventive avg = RM 3000 and reactive avg = RM 7000,
    #     saving_rate = 1 - (3000/7000) = 0.571  → 57% saving
    #
    # Confidence blending:
    #   With few data points the ratio can be extreme (one lucky cheap task
    #   vs one expensive one). We blend with the industry default (0.35)
    #   using a confidence weight that grows with sample size.
    #   At 0 completed tasks  → 100% industry default (0.35)
    #   At 6 completed tasks  → 50/50 blend
    #   At 20+ completed tasks → 95%+ your own data
    #
    INDUSTRY_DEFAULT_SAVING_RATE = 0.35
    MIN_TASKS_FOR_FULL_CONFIDENCE = 20  # tune this as your dataset grows

    completed_tasks = [t for t in approved_tasks if t.task_status == "Completed"
                       and t.cost_estimation is not None]

    preventive_proxy = [t for t in completed_tasks
                        if t.severity_validation in ("Low", "Medium")]
    reactive_proxy   = [t for t in completed_tasks
                        if t.severity_validation in ("High", "Critical")]

    avg_preventive_cost = (
        sum(t.cost_estimation for t in preventive_proxy) / len(preventive_proxy)
        if preventive_proxy else None
    )
    avg_reactive_cost = (
        sum(t.cost_estimation for t in reactive_proxy) / len(reactive_proxy)
        if reactive_proxy else None
    )

    # Can only compute a real ratio if we have both proxy groups
    if avg_preventive_cost is not None and avg_reactive_cost is not None and avg_reactive_cost > 0:
        raw_saving_rate = 1.0 - (avg_preventive_cost / avg_reactive_cost)
        # Clamp to a sensible range (0% to 70%) — outliers shouldn't produce
        # negative savings or implausibly high figures
        raw_saving_rate = max(0.0, min(0.70, raw_saving_rate))

        # Confidence weight: how much to trust our own data vs industry default
        n_completed = len(completed_tasks)
        confidence  = min(1.0, n_completed / MIN_TASKS_FOR_FULL_CONFIDENCE)
        saving_rate = (confidence * raw_saving_rate) + ((1 - confidence) * INDUSTRY_DEFAULT_SAVING_RATE)
        saving_rate_source = (
            f"derived ({n_completed} completed tasks, "
            f"{round(confidence * 100)}% confidence, "
            f"blended with {round((1-confidence)*100)}% industry default)"
        )
    else:
        # Not enough completed tasks in both groups — fall back to industry default
        saving_rate = INDUSTRY_DEFAULT_SAVING_RATE
        n_completed = len(completed_tasks)
        if n_completed == 0:
            saving_rate_source = "industry default (no completed tasks yet)"
        elif not preventive_proxy:
            saving_rate_source = f"industry default (no Low/Medium completed tasks yet — {n_completed} High/Critical only)"
        elif not reactive_proxy:
            saving_rate_source = f"industry default (no High/Critical completed tasks yet — {n_completed} Low/Medium only)"
        else:
            saving_rate_source = "industry default (fallback)"

    # ── Pre-compute 12-month projection with derived saving rate ────────────
    # Malaysian seasonal factors: SW monsoon (May-Sep) drives more field work;
    # NE monsoon (Nov-Jan) causes access delays and deferred tasks.
    SEASONAL = {
        "Jan": 0.85, "Feb": 0.90, "Mar": 1.00, "Apr": 1.05,
        "May": 1.10, "Jun": 1.15, "Jul": 1.10, "Aug": 1.05,
        "Sep": 1.00, "Oct": 0.95, "Nov": 0.85, "Dec": 0.80,
    }

    # Use real+mock monthly data to compute the baseline avg
    if monthly_costs:
        observed_monthly_avg = sum(monthly_costs.values()) / len(monthly_costs)
    else:
        observed_monthly_avg = avg_cost if avg_cost > 0 else 5000.0

    # Trend: compute from the chronological monthly cost sequence
    month_keys = [m for m in MONTH_ORDER if m in monthly_costs]
    if len(month_keys) >= 2:
        first_cost = monthly_costs[month_keys[0]]
        last_cost  = monthly_costs[month_keys[-1]]
        raw_growth = (last_cost / first_cost) ** (1 / max(len(month_keys) - 1, 1)) if first_cost > 0 else 1.0
        trend_multiplier = max(0.90, min(1.10, raw_growth))
    else:
        trend_multiplier = 1.02

    # ── 12-month forward projection starting from next_month ────────────────
    start_month_idx = MONTH_ORDER.index(next_month)
    projection_months = []
    for i in range(12):
        month_abbr = MONTH_ORDER[(start_month_idx + i) % 12]
        seasonal   = SEASONAL[month_abbr]
        growth     = trend_multiplier ** (i + 1)
        projected  = round(observed_monthly_avg * seasonal * growth, 2)
        preventive = round(projected * (1 - saving_rate), 2)
        projection_months.append({
            "month":      month_abbr,
            "projected":  projected,
            "preventive": preventive,
        })

    projected_total       = round(sum(m["projected"]  for m in projection_months), 2)
    preventive_total      = round(sum(m["preventive"] for m in projection_months), 2)
    potential_savings_12mo = round(projected_total - preventive_total, 2)

    # ── Combined chart series: historical actual + 12-month projection ───────
    # Frontend renders this as a single continuous line chart.
    # Historical months have "actual" filled, projected=None.
    # Projected months have "projected"+"preventive" filled, actual=None.
    # The month where they meet is the current month — it carries both values
    # so the lines connect visually without a gap.
    chart_series = []

    # Historical months (Jan → current month inclusive)
    for m_idx in range(now.month):
        month_abbr   = MONTH_ORDER[m_idx]
        actual_cost  = monthly_costs.get(month_abbr)
        is_current   = (m_idx == now.month - 1)
        entry = {
            "month":      month_abbr,
            "actual":     round(actual_cost, 2) if actual_cost is not None else None,
            "projected":  None,
            "preventive": None,
            "is_mock":    month_abbr not in {
                              t.created_date.strftime("%b")
                              for t in monthly_tasks if t.created_date
                          },
        }
        if is_current and projection_months:
            # Anchor: carry forward the first projected value so lines connect
            entry["projected"]  = projection_months[0]["projected"]
            entry["preventive"] = projection_months[0]["preventive"]
        chart_series.append(entry)

    # Projected months (next_month → +11 months)
    for proj in projection_months:
        chart_series.append({
            "month":      proj["month"],
            "actual":     None,
            "projected":  proj["projected"],
            "preventive": proj["preventive"],
            "is_mock":    False,
        })

    return {
        "snapshot_date":                 now.strftime("%Y-%m-%d"),
        "next_projection_month":         next_month,
        "months_elapsed_this_year":      months_elapsed,
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
        # Pre-computed projection — AI uses these directly, no more flat lines
        "projection_months":             projection_months,   # 12 forward months
        "projected_12mo_total":          projected_total,
        "preventive_12mo_total":         preventive_total,
        "potential_savings_12mo":        potential_savings_12mo,
        "potential_savings_6mo":         round(sum(m["projected"] - m["preventive"] for m in projection_months[:6]), 2),
        "chart_series":                  chart_series,        # historical + projected combined
        "observed_monthly_avg_cost":     round(observed_monthly_avg, 2),
        "trend_multiplier":              round(trend_multiplier, 4),
        # Saving rate metadata — passed through to frontend for transparency
        "saving_rate":                   round(saving_rate, 4),
        "saving_rate_pct":               round(saving_rate * 100, 1),
        "saving_rate_source":            saving_rate_source,
        "avg_preventive_proxy_cost":     round(avg_preventive_cost, 2) if avg_preventive_cost else None,
        "avg_reactive_proxy_cost":       round(avg_reactive_cost, 2)   if avg_reactive_cost   else None,
        "preventive_proxy_count":        len(preventive_proxy),
        "reactive_proxy_count":          len(reactive_proxy),
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
        })
    return result


@app.put("/tasks/{task_id}/maintenance")
async def update_maintenance(task_id: int, data: TaskMaintenance, db: db_dependency):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    raw  = task.work_log
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
    task.work_log = [*existing, new_entry]  # brand new list — SQLAlchemy sees a new object
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
# Analytics insights
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# GET /analytics/chart-data  — fast, no AI, returns Jan-Dec cost history
# Called on page mount so the chart renders immediately without waiting for AI.
# ---------------------------------------------------------------------------

@app.get("/analytics/chart-data")
async def get_analytics_chart_data(db: db_dependency):
    """
    Returns a fixed Jan-Dec array with actual monthly costs from the DB
    (plus mock estimates for months with no tasks yet).
    No AI call — responds instantly.

    Each entry: { month, actual, is_mock }
    projected/preventive are null until the AI insights endpoint is called.
    """
    import random
    random.seed(42)

    MONTH_ORDER = ["Jan","Feb","Mar","Apr","May","Jun",
                   "Jul","Aug","Sep","Oct","Nov","Dec"]
    SEASONAL_MOCK = {
        "Jan": 0.82, "Feb": 0.88, "Mar": 0.95, "Apr": 1.05,
        "May": 1.12, "Jun": 1.18, "Jul": 1.10, "Aug": 1.03,
        "Sep": 0.98, "Oct": 0.93, "Nov": 0.84, "Dec": 0.78,
    }

    now        = datetime.utcnow()
    year_start = datetime(now.year, 1, 1)

    # Real monthly costs from DB (all approved tasks this year)
    monthly_tasks = db.query(Task).filter(Task.created_date >= year_start).all()
    real_months: set[str] = set()
    monthly_costs: dict[str, float] = {}
    for t in monthly_tasks:
        if t.created_date:
            key = t.created_date.strftime("%b")
            monthly_costs[key] = monthly_costs.get(key, 0) + (t.cost_estimation or 0)
            real_months.add(key)

    # Baseline for mock: avg cost across approved tasks, fallback RM 5000
    approved_tasks = db.query(Task).filter(Task.validation_status == "Approved").all()
    total_cost = sum(t.cost_estimation or 0 for t in approved_tasks)
    avg_cost   = (total_cost / len(approved_tasks)) if approved_tasks else 5000.0
    mock_base  = avg_cost if avg_cost > 0 else 5000.0

    # Build fixed Jan-Dec array
    chart = []
    for idx, month_abbr in enumerate(MONTH_ORDER):
        month_num = idx + 1  # 1=Jan … 12=Dec

        if month_num < now.month:
            # Past month — real data if available, else mock estimate
            if month_abbr in monthly_costs:
                actual  = round(monthly_costs[month_abbr], 2)
                is_mock = False
            else:
                seasonal = SEASONAL_MOCK[month_abbr]
                noise    = random.uniform(0.88, 1.12)
                actual   = round(mock_base * seasonal * noise, 2)
                is_mock  = True
        elif month_num == now.month:
            # Current month — use real data if any tasks exist, else mock
            if month_abbr in monthly_costs:
                actual  = round(monthly_costs[month_abbr], 2)
                is_mock = False
            else:
                seasonal = SEASONAL_MOCK[month_abbr]
                actual   = round(mock_base * seasonal, 2)
                is_mock  = True
        else:
            # Future month — no actual data yet
            actual  = None
            is_mock = False

        chart.append({
            "month":      month_abbr,
            "actual":     actual,
            "projected":  None,   # filled in by /analytics/insights when AI runs
            "preventive": None,   # filled in by /analytics/insights when AI runs
            "is_mock":    is_mock,
            "is_current": month_num == now.month,
            "is_future":  month_num > now.month,
        })

    return {
        "chart": chart,
        "current_month": now.strftime("%b"),
        "year": now.year,
        "has_mock": any(e["is_mock"] for e in chart),
    }


# ---------------------------------------------------------------------------
# In-memory cache for analytics insights
# Regenerated only when ?refresh=true is passed (triggered by the Refresh button).
# On every normal page load the cached result is returned instantly.
# ---------------------------------------------------------------------------
_insights_cache: dict | None = None


def _build_insights_response(stats: dict, report: AnalyticsInsightsReport) -> dict:
    """
    Assemble the final response dict from stats + AI report.

    Produces a fixed Jan-Dec chart by merging the 12-month forward projection
    into the correct month slots of the full-year array.
    Slots before current month keep actual/mock costs.
    Slots from current month onward get projected + preventive values.
    The current month carries both actual and projected so lines connect.
    """
    MONTH_ORDER = ["Jan","Feb","Mar","Apr","May","Jun",
                   "Jul","Aug","Sep","Oct","Nov","Dec"]

    now         = datetime.utcnow()
    current_idx = now.month - 1   # 0-based index of current month

    # Build projected/preventive lookup keyed by month abbreviation.
    # The 12-month projection starts at next_month; some months wrap to next year
    # but we only care about months that fall within Jan-Dec of THIS year.
    proj_lookup: dict[str, dict] = {}
    for entry in stats.get("projection_months", []):
        proj_lookup[entry["month"]] = entry

    # Build fixed Jan-Dec array
    monthly_costs = stats.get("monthly_costs_this_year", {})
    real_months   = set(monthly_costs.keys())

    import random
    random.seed(42)
    SEASONAL_MOCK = {
        "Jan": 0.82, "Feb": 0.88, "Mar": 0.95, "Apr": 1.05,
        "May": 1.12, "Jun": 1.18, "Jul": 1.10, "Aug": 1.03,
        "Sep": 0.98, "Oct": 0.93, "Nov": 0.84, "Dec": 0.78,
    }
    mock_base = stats.get("observed_monthly_avg_cost", 5000.0)

    chart_series = []
    for idx, month_abbr in enumerate(MONTH_ORDER):
        month_num = idx + 1

        # Actual cost for past + current months
        if month_num <= now.month:
            if month_abbr in monthly_costs:
                actual  = round(monthly_costs[month_abbr], 2)
                is_mock = False
            else:
                seasonal = SEASONAL_MOCK[month_abbr]
                noise    = random.uniform(0.88, 1.12)
                actual   = round(mock_base * seasonal * noise, 2)
                is_mock  = True
        else:
            actual  = None
            is_mock = False

        # Projected + preventive for current month onward (anchor + forward)
        proj_entry = proj_lookup.get(month_abbr)
        if month_num >= now.month and proj_entry:
            projected  = proj_entry["projected"]
            preventive = proj_entry["preventive"]
        else:
            projected  = None
            preventive = None

        chart_series.append({
            "month":      month_abbr,
            "actual":     actual,
            "projected":  projected,
            "preventive": preventive,
            "is_mock":    is_mock,
            "is_current": month_num == now.month,
            "is_future":  month_num > now.month,
        })

    potential_savings = stats.get("potential_savings_12mo",
                        stats.get("potential_savings_6mo", report.potential_savings))
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
    Returns the cached AI analytics report on normal page loads.
    Pass ?refresh=true to force a fresh Gemini API call and update the cache.

    refresh=false (default) → return cached result instantly, no API call
    refresh=true            → re-aggregate stats + call Gemini, update cache
    """
    global _insights_cache

    # Serve cache if available and refresh not requested
    if _insights_cache is not None and not refresh:
        return _insights_cache

    # Generate fresh report
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

    _insights_cache = _build_insights_response(stats, report)
    return _insights_cache
