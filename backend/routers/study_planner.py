"""
Conversational Study Planner — AI-powered draft/modify/accept flow.

Flow:
1. POST /api/ai/study-plan/draft    → Gemini generates a plan (NOT persisted)
2. POST /api/ai/study-plan/modify   → User asks for changes, Gemini modifies (NOT persisted)
3. POST /api/ai/study-plan/accept   → User confirms, FastAPI persists to DynamoDB

Plans remain drafts until explicitly accepted.
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional
from services.gemini import generate_workload_balance, chat_completion, GeminiError, _extract_json, get_model
from services.dynamodb import (
    get_all, get_by_id, put_item, generate_id, award_xp,
)
import json

router = APIRouter(prefix="/api/ai/study-plan", tags=["study-planner"])


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class DraftRequest(BaseModel):
    userId: str
    message: str = Field(default="", description="Optional user message describing preferences")
    horizonDays: int = Field(default=14, ge=1, le=60)


class ModifyRequest(BaseModel):
    userId: str
    message: str = Field(..., min_length=2, description="What the user wants to change")
    currentPlan: list[dict] = Field(..., description="The current draft plan to modify")


class AcceptRequest(BaseModel):
    userId: str
    plan: list[dict] = Field(..., description="The finalized plan sessions to persist")
    summary: str = ""


# ---------------------------------------------------------------------------
# 1. Generate Draft (NOT persisted)
# ---------------------------------------------------------------------------

@router.post("/draft")
async def generate_draft(req: DraftRequest):
    """
    Generate a study plan draft using Gemini.
    Retrieves user's assignments from DynamoDB, sends to Gemini, returns draft.
    The draft is NOT persisted — it stays client-side until accepted.
    """
    if not req.userId:
        raise HTTPException(status_code=400, detail={"error": "userId is required"})

    # Retrieve user data from DynamoDB
    all_assignments = get_all("assignments")
    assignments = [a for a in all_assignments if a.get("userId") == req.userId]
    pending = [a for a in assignments if a.get("status") != "completed"]

    if not pending:
        return {
            "status": "draft",
            "study_plan": [],
            "summary": "You have no pending assignments. Add some commitments first.",
            "totalHours": 0,
            "message": "Nothing to plan — all your work is done.",
        }

    all_plans = get_all("study_plans")
    user_assignment_ids = {a["id"] for a in assignments}
    user_plans = [p for p in all_plans if p.get("assignmentId") in user_assignment_ids]

    try:
        result = await generate_workload_balance(
            assignments=pending,
            study_plans=user_plans,
            available_hours_per_day=3.0,
            horizon_days=req.horizonDays,
        )
    except GeminiError as e:
        raise HTTPException(status_code=503, detail={"error": str(e)})

    return {
        "status": "draft",
        "study_plan": result.get("study_plan", []),
        "summary": result.get("summary", ""),
        "totalHours": result.get("totalHours", 0),
        "message": "Here's a proposed study plan. You can ask me to modify it before accepting.",
    }


# ---------------------------------------------------------------------------
# 2. Modify Draft (NOT persisted)
# ---------------------------------------------------------------------------

@router.post("/modify")
async def modify_draft(req: ModifyRequest):
    """
    Modify an existing draft plan based on user's conversational request.
    Returns the modified plan without persisting it.
    """
    if not req.userId:
        raise HTTPException(status_code=400, detail={"error": "userId is required"})

    model = get_model()
    if not model:
        raise HTTPException(status_code=503, detail={"error": "GEMINI_API_KEY is not configured."})

    # Get user's assignments for context
    all_assignments = get_all("assignments")
    assignments = [a for a in all_assignments if a.get("userId") == req.userId]

    current_plan_json = json.dumps(req.currentPlan, indent=2)
    assignments_json = json.dumps([
        {"id": a["id"], "title": a.get("title", ""), "deadline": a.get("deadline", ""),
         "module": a.get("module", ""), "weightage": a.get("weightage", 0)}
        for a in assignments if a.get("status") != "completed"
    ], indent=2)

    prompt = f"""You are a study schedule assistant. The student wants to modify their draft study plan.

CURRENT DRAFT PLAN:
{current_plan_json}

STUDENT'S ASSIGNMENTS:
{assignments_json}

STUDENT'S REQUEST: "{req.message}"

Modify the plan according to the student's request. Return ONLY a JSON object:
{{
  "study_plan": [
    {{
      "date": "YYYY-MM-DD",
      "assignmentId": "assignment ID",
      "title": "What to work on",
      "duration_minutes": 60,
      "reason": "Why scheduled here"
    }}
  ],
  "summary": "Brief description of what was changed",
  "changes_made": "What specific changes were applied"
}}

Rules:
- Keep sessions that weren't mentioned in the request
- Only modify what the student asked to change
- Dates must be YYYY-MM-DD format, not in the past
- Duration must be 30-120 minutes
- Return ONLY valid JSON"""

    try:
        response = model.generate_content(prompt)
        parsed = _extract_json(response.text)

        if not isinstance(parsed, dict):
            raise GeminiError("Gemini returned invalid format")

        sessions = parsed.get("study_plan", [])
        summary = str(parsed.get("summary", ""))
        changes = str(parsed.get("changes_made", ""))

        # Validate sessions
        validated = []
        for session in sessions:
            if not isinstance(session, dict):
                continue
            date_str = str(session.get("date", ""))
            duration = session.get("duration_minutes", 60)
            duration = max(30, min(120, int(duration)))
            validated.append({
                "date": date_str,
                "assignmentId": str(session.get("assignmentId", "")),
                "title": str(session.get("title", "")),
                "duration_minutes": duration,
                "reason": str(session.get("reason", "")),
            })

        total_hours = round(sum(s["duration_minutes"] for s in validated) / 60, 1)

        return {
            "status": "draft",
            "study_plan": validated,
            "summary": summary,
            "changes_made": changes,
            "totalHours": total_hours,
            "message": "Plan modified. Ask for more changes or accept when you're happy with it.",
        }

    except GeminiError:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail={"error": f"Modification failed: {str(e)}"})


# ---------------------------------------------------------------------------
# 3. Accept and Persist
# ---------------------------------------------------------------------------

@router.post("/accept")
async def accept_plan(req: AcceptRequest):
    """
    Accept a draft plan and persist it to DynamoDB.
    This is the ONLY point where AI-generated plans are saved.
    """
    if not req.userId:
        raise HTTPException(status_code=400, detail={"error": "userId is required"})

    if not req.plan:
        raise HTTPException(status_code=400, detail={"error": "No plan sessions to accept"})

    # Validate all sessions before persisting
    all_assignments = get_all("assignments")
    user_assignments = {a["id"]: a for a in all_assignments if a.get("userId") == req.userId}
    all_plans = get_all("study_plans")

    # Group sessions by assignmentId
    by_assignment: dict[str, list] = {}
    for session in req.plan:
        if not isinstance(session, dict):
            continue
        aid = session.get("assignmentId", "")
        if not aid:
            continue
        # Validate the assignment belongs to this user
        if aid not in user_assignments:
            continue
        by_assignment.setdefault(aid, []).append(session)

    if not by_assignment:
        raise HTTPException(status_code=400, detail={"error": "No valid sessions to persist"})

    # Persist: create/update study plans
    persisted_plans = []
    for assignment_id, sessions in by_assignment.items():
        assignment = user_assignments[assignment_id]

        # Find existing plan for this assignment
        existing_plan = next(
            (p for p in all_plans if p.get("assignmentId") == assignment_id),
            None
        )

        tasks = []
        for i, session in enumerate(sessions):
            duration = session.get("duration_minutes", 60)
            duration = max(30, min(240, int(duration)))
            tasks.append({
                "id": f"task-{generate_id()}",
                "title": session.get("title", "Study session"),
                "scheduledDate": session.get("date", ""),
                "duration": duration,
                "completed": False,
                "order": i + 1,
            })

        if existing_plan:
            # Replace incomplete tasks with new plan
            completed_tasks = [t for t in existing_plan.get("tasks", []) if t.get("completed")]
            existing_plan["tasks"] = completed_tasks + tasks
            existing_plan["estimatedHours"] = round(
                sum(t.get("duration", 0) for t in existing_plan["tasks"]) / 60, 2
            )
            existing_plan["updatedAt"] = datetime.utcnow().isoformat()
            existing_plan["status"] = "accepted"
            put_item("study_plans", existing_plan)
            persisted_plans.append(existing_plan["id"])
        else:
            new_plan = {
                "id": generate_id(),
                "assignmentId": assignment_id,
                "assignmentTitle": assignment.get("title", ""),
                "module": assignment.get("module", ""),
                "totalDays": max(1, len(set(t["scheduledDate"] for t in tasks))),
                "tasks": tasks,
                "estimatedHours": round(sum(t["duration"] for t in tasks) / 60, 2),
                "status": "accepted",
                "createdAt": datetime.utcnow().isoformat(),
            }
            put_item("study_plans", new_plan)
            persisted_plans.append(new_plan["id"])

    # Award XP
    award_xp(req.userId, 15, "Accepted AI study plan")

    return {
        "status": "accepted",
        "persisted": True,
        "planIds": persisted_plans,
        "message": f"Study plan saved. {len(persisted_plans)} plan(s) created/updated.",
    }
