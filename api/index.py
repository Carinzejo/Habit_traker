import os
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI
from pydantic import BaseModel
from datetime import date, timedelta

app = FastAPI()

DATABASE_URL = os.environ.get("DATABASE_URL")

def get_connection():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL environment variable is not set!")
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS missions (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_logs (
            id SERIAL PRIMARY KEY,
            mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
            log_date TEXT NOT NULL,
            status TEXT NOT NULL,
            UNIQUE(mission_id, log_date)
        )
    """)
    conn.commit()
    conn.close()

class MissionCreate(BaseModel):
    title: str

class LogEntry(BaseModel):
    mission_id: int
    log_date: str
    status: str

@app.post("/api/missions")
def create_mission(mission: MissionCreate):
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    today_str = date.today().isoformat()
    cursor.execute(
        "INSERT INTO missions (title, created_at) VALUES (%s, %s) RETURNING id",
        (mission.title, today_str)
    )
    new_id = cursor.fetchone()["id"]
    conn.commit()
    conn.close()
    return {"id": new_id, "title": mission.title}

@app.get("/api/missions")
def get_missions():
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM missions ORDER BY id ASC")
    missions = cursor.fetchall()
    conn.close()
    return missions

@app.get("/api/logs/{mission_id}")
def get_logs(mission_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT created_at FROM missions WHERE id = %s", (mission_id,))
    mission = cursor.fetchone()
    if mission:
        start_date = date.fromisoformat(mission["created_at"])
        yesterday = date.today() - timedelta(days=1)
        
        current = start_date
        while current <= yesterday:
            day_str = current.isoformat()
            cursor.execute(
                """
                INSERT INTO daily_logs (mission_id, log_date, status)
                VALUES (%s, %s, 'missed')
                ON CONFLICT (mission_id, log_date) DO NOTHING
                """,
                (mission_id, day_str)
            )
            current += timedelta(days=1)
        conn.commit()

    cursor.execute("SELECT log_date, status FROM daily_logs WHERE mission_id = %s", (mission_id,))
    logs = cursor.fetchall()
    conn.close()
    return {row["log_date"]: row["status"] for row in logs}

@app.post("/api/log")
def update_log(entry: LogEntry):
    conn = get_connection()
    cursor = conn.cursor()
    
    if entry.status == "none":
        cursor.execute(
            "DELETE FROM daily_logs WHERE mission_id = %s AND log_date = %s",
            (entry.mission_id, entry.log_date)
        )
    else:
        cursor.execute(
            """
            INSERT INTO daily_logs (mission_id, log_date, status)
            VALUES (%s, %s, %s)
            ON CONFLICT (mission_id, log_date) DO UPDATE SET status = EXCLUDED.status
            """,
            (entry.mission_id, entry.log_date, entry.status)
        )
        
    conn.commit()
    conn.close()
    return {"status": entry.status, "date": entry.log_date}