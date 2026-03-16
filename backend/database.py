import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from google.cloud import storage as gcs
import base64
 
load_dotenv()

# Fetch variables
USER = os.getenv("user")
PASSWORD = os.getenv("password")
HOST = os.getenv("host")
PORT = os.getenv("port")
DBNAME = os.getenv("dbname")

# Construct the SQLAlchemy connection string
DATABASE_URL = f"postgresql+psycopg2://{USER}:{PASSWORD}@{HOST}:{PORT}/{DBNAME}?sslmode=require"

# Create the SQLAlchemy engine
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── Google Cloud Storage ─────────────────────────────────────────────────────
GCS_BUCKET = os.getenv("GCS_BUCKET_NAME", "")
GCS_KEY_FILE = os.getenv("GCS_KEY_FILE", "")  # explicit path — does NOT affect Cloud SQL ADC
GCS_SIGNED_URL_EXPIRY_MINUTES = int(os.getenv("GCS_SIGNED_URL_EXPIRY_MINUTES", "60"))


def _gcs_client():
    """Build a GCS client using the explicit key file, never touching ADC."""
    if GCS_KEY_FILE and os.path.exists(GCS_KEY_FILE):
        from google.oauth2 import service_account
        creds = service_account.Credentials.from_service_account_file(
            GCS_KEY_FILE,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        return gcs.Client(credentials=creds)
    return gcs.Client()  # fallback to ADC if no key file set


def upload_image_to_gcs(base64_data: str, destination_blob: str) -> str:
    """
    Upload a base64-encoded image to GCS (private bucket).
    Returns the blob path — sign at read time with get_signed_url().
    Falls back to returning raw base64 if GCS is not configured.
    """
    if not GCS_BUCKET:
        return base64_data

    if "," in base64_data:
        header, b64 = base64_data.split(",", 1)
        content_type = header.split(":")[1].split(";")[0] if ":" in header else "image/jpeg"
    else:
        b64 = base64_data
        content_type = "image/jpeg"

    image_bytes = base64.b64decode(b64)
    client = _gcs_client()
    bucket = client.bucket(GCS_BUCKET)
    blob = bucket.blob(destination_blob)
    blob.upload_from_string(image_bytes, content_type=content_type)
    return destination_blob


def get_signed_url(blob_path: str, expiry_minutes: int = GCS_SIGNED_URL_EXPIRY_MINUTES) -> str:
    """Generate a signed URL for a private GCS blob. Valid for expiry_minutes."""
    if not GCS_BUCKET:
        return blob_path
    if blob_path.startswith("data:") or blob_path.startswith("http"):
        return blob_path

    from datetime import timedelta
    if GCS_KEY_FILE and os.path.exists(GCS_KEY_FILE):
        from google.oauth2 import service_account
        creds = service_account.Credentials.from_service_account_file(
            GCS_KEY_FILE,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        client = gcs.Client(credentials=creds)
    else:
        client = gcs.Client()
    bucket = client.bucket(GCS_BUCKET)
    blob = bucket.blob(blob_path)
    return blob.generate_signed_url(
        version="v4",
        expiration=timedelta(minutes=expiry_minutes),
        method="GET",
    )


def sign_image_list(paths: list) -> list:
    """Convenience wrapper — sign a list of blob paths."""
    return [get_signed_url(p) for p in paths if p]
