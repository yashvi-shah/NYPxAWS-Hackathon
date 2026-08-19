"""
Gravity — FastAPI Backend (API-only)
Entry point. Run with: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""
import sys
import os

# Ensure the backend directory is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Gravity API",
    description="Academic workload management backend for polytechnic students.",
    version="1.0.0",
)

# CORS — allow the frontend to talk to us
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:3000", "http://localhost:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

from routers.auth import router as auth_router
from routers.assignments import router as assignments_router
from routers.study_plans import router as study_plans_router
from routers.analytics import router as analytics_router
from routers.community import router as community_router
from routers.gamification import router as gamification_router
from routers.chat import router as chat_router
from routers.ai import router as ai_router
from routers.study_planner import router as study_planner_router
from routers.calendar import router as calendar_router
from routers.uploads import router as uploads_router

app.include_router(auth_router)
app.include_router(assignments_router)
app.include_router(study_plans_router)
app.include_router(analytics_router)
app.include_router(community_router)
app.include_router(gamification_router)
app.include_router(chat_router)
app.include_router(ai_router)
app.include_router(study_planner_router)
app.include_router(calendar_router)
app.include_router(uploads_router)

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "gravity-api", "dev_mode": settings.dev_mode}


# ---------------------------------------------------------------------------
# Seed data in dev mode
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup():
    if settings.dev_mode:
        print("\n  [Gravity] Dev mode — seeding in-memory database...")
        from seed_data import seed
        seed()
    print(f"\n  [Gravity] Running at http://localhost:8000")
    print(f"  [Gravity] API docs at http://localhost:8000/docs")
    print(f"  [Gravity] DEV_MODE={settings.dev_mode}\n")
