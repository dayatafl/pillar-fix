import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from google.cloud.sql.connector import Connector

load_dotenv()

USER       = os.getenv("user")
PASSWORD   = os.getenv("password")
DBNAME     = os.getenv("dbname")
CONNECTION = os.getenv("connection")

# Do NOT pass credentials here — let Cloud SQL Connector use
# Application Default Credentials (gcloud auth application-default login)
# which is what was working before.
_connector = Connector()

def getconn():
    return _connector.connect(
        CONNECTION,
        "pg8000",
        user=USER,
        password=PASSWORD,
        db=DBNAME,
    )

engine = create_engine("postgresql+pg8000://", creator=getconn)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()