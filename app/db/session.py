from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = BASE_DIR / "data" / "stroymaterialy.db"

load_dotenv(BASE_DIR / ".env")

# Defaults to the local SQLite file; set DATABASE_URL (in .env, see .env.example)
# to point at PostgreSQL instead - e.g. after migrating with pgloader (see README).
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DB_PATH}")

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_session() -> Session:
    return SessionLocal()
