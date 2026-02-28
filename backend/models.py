from database import Base
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Float,
    DateTime,
    Text,
    JSON,
    ForeignKey,
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    employeeId = Column(String, unique=True, index=True, nullable=False)
    role = Column(String, nullable=False)
    isActive = Column(Boolean, default=True, nullable=False)
    createdAt = Column(DateTime)
    locality = Column(String)
    password = Column(String, nullable=False)


class Pillar(Base):
    __tablename__ = "pillars"

    id = Column(Integer, primary_key=True, index=True)
    pillarId = Column(String, unique=True, index=True, nullable=False)
    address = Column(String)
    locality = Column(String)
    # Stored as { "lat": float, "lng": float } — matches frontend coordinate shape
    coordinates = Column(JSON)


class Task(Base):
    __tablename__ = "tasks"

    task_id = Column(Integer, primary_key=True, index=True)
    pillar_id = Column(String, ForeignKey("pillars.pillarId"), nullable=False)
    task_status = Column(String, default="Pending")          # Pending / Submitted / Validated / Completed

    # assigned_to: the technician responsible for the audit
    assigned_to = Column(String, ForeignKey("users.employeeId"))
    # created_by: the supervisor/system that created the task record
    created_by = Column(String, ForeignKey("users.employeeId"))

    due_date = Column(DateTime)         # DateTime (not Date) — consistent with Pydantic
    created_date = Column(DateTime)
    updated_date = Column(DateTime)

    # Audit images (base64 or URLs)
    image_1 = Column(String)            # front
    image_2 = Column(String)            # right
    image_3 = Column(String)            # back
    image_4 = Column(String)            # left

    # GPS location captured by technician: { lat, lng }
    user_current_location = Column(JSON)

    # Link to the Photo record created after AI detection
    detection_result_id = Column(String, ForeignKey("photos.photo_id"))

    # Supervisor validation fields
    validation_status = Column(String)
    severity_validation = Column(String)
    priority_validation = Column(String)
    cost_estimation = Column(Float)
    remarks = Column(Text)
    validation_by = Column(String, ForeignKey("users.employeeId"))

    # Maintenance fields
    maintenance_status = Column(String)         # fixed spelling (was maintainance_status)
    work_log = Column(JSON, default=list)       # list of { action, notes, images[], timestamp }
    logged_by = Column(String, ForeignKey("users.employeeId"))
    completion_evidence = Column(String)
    maintenance_validate_by = Column(String, ForeignKey("users.employeeId"))  # fixed spelling


class ModelTraining(Base):
    """Reserved for future YOLO training data management."""
    __tablename__ = "model_training"

    id = Column(Integer, primary_key=True, index=True)
    image = Column(String)
    output_class = Column(String)


class Photo(Base):
    """
    One Photo record per task submission.
    Stores the full inference JSON returned by the AI model.
    Individual bounding boxes are stored in the Detection table.
    """
    __tablename__ = "photos"

    photo_id = Column(String, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.task_id"), nullable=False)
    # Full inference payload: { status, total_detection, detections: [...] }
    inference = Column(JSON)
    created_date = Column(DateTime)
    # NOTE: x/y/width/height removed — those belong in Detection rows, not here


class Detection(Base):
    """
    One row per bounding box per image.
    image_index (1-4) maps to image_1 / image_2 / image_3 / image_4 on Task.
    """
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    photo_id = Column(String, ForeignKey("photos.photo_id"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.task_id"), nullable=False)  # fixed: was String
    image_index = Column(Integer)       # 1=front, 2=right, 3=back, 4=left
    x = Column(Float)
    y = Column(Float)
    height = Column(Float)
    width = Column(Float)
    faulty_type = Column(String)
    confidence_level = Column(Float)