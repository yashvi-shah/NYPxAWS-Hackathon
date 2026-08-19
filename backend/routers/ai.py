"""
AI-powered endpoints: flashcards, calendar actions, workload balancing.
All use Gemini via the gemini service. All validate output before persisting to DynamoDB.
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime
from models.ai import (
    FlashcardGenerateRequest, FlashcardSet,
    CalendarActionRequest, CalendarActionResponse, CalendarAction,
    WorkloadBalanceRequest, WorkloadBalanceResponse,
)
from services.gemini import (
    generate_flashcards, generate_calendar_actions, generate_workload_balance, GeminiError,
)
from services.dynamodb import (
    get_all, get_by_id, put_item, delete_item, generate_id, query_by_user, award_xp,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


# ---------------------------------------------------------------------------
# 1. Flashcard Generation
# ---------------------------------------------------------------------------

@router.post("/flashcards")
async def create_flashcards(req: FlashcardGenerateRequest):
    """Generate flashcards from study material using Gemini, persist to DynamoDB."""
    try:
        cards = await generate_flashcards(
            material=req.material,
            topic=req.topic,
            count=req.count,
        )
    except GeminiError as e:
        raise HTTPException(status_code=503, detail={"error": str(e)})

    # Persist flashcard set
    flashcard_set = {
        "id": generate_id(),
        "userId": req.userId,
        "topic": req.topic or cards[0].get("topic", "General"),
        "cards": cards,
        "cardCount": len(cards),
        "createdAt": datetime.utcnow().isoformat(),
    }
    put_item("flashcards", flashcard_set)

    # Award XP for generating flashcards
    if req.userId:
        award_xp(req.userId, 10, f"Generated {len(cards)} flashcards")

    return flashcard_set


@router.get("/flashcards")
async def list_flashcards(userId: str = ""):
    """Get all flashcard sets, optionally filtered by userId."""
    if userId:
        return query_by_user("flashcards", userId)
    return get_all("flashcards")


@router.get("/flashcards/{set_id}")
async def get_flashcard_set(set_id: str):
    """Get a specific flashcard set by ID."""
    item = get_by_id("flashcards", set_id)
    if not item:
        raise HTTPException(status_code=404, detail={"error": "Flashcard set not found"})
    return item


@router.delete("/flashcards/{set_id}")
async def delete_flashcard_set(set_id: str):
    """Delete a flashcard set."""
    delete_item("flashcards", set_id)
    return {"success": True}


# ---------------------------------------------------------------------------
# 2. Calendar / Study Plan Actions
# ---------------------------------------------------------------------------

@router.post("/calendar-actions")
async def propose_calendar_actions(req: CalendarActionRequest):
    """
    Parse user's natural language into structured calendar actions.
    Validates actions, then applies them to DynamoDB study plans.
    """
    # Retrieve user's data for context
    user_id = req.userId
    if not user_id:
        raise HTTPException(status_code=400, detail={"error": "userId is required"})

    assignments = [a for a in get_all("assignments") if a.get("userId") == user_id]
    study_plans = get_all("study_plans")
    # Filter plans to those belonging to user's assignments
    user_assignment_ids = {a["id"] for a in assignments}
    user_plans = [p for p in study_plans if p.get("assignmentId") in user_assignment_ids]

    try:
        result = await generate_calendar_actions(
            user_request=req.userRequest,
            assignments=assignments,
            study_plans=user_plans,
        )
    except GeminiError as e:
        raise HTTPException(status_code=503, detail={"error": str(e)})

    actions = result.get("actions", [])
    explanation = result.get("explanation", "")

    # Apply validated actions to DynamoDB
    applied_count = 0
    for action in actions:
        try:
            success = _apply_calendar_action(action, user_plans, assignments, user_id)
            if success:
                applied_count += 1
        except Exception:
            continue  # Skip actions that fail validation

    return {
        "actions": actions,
        "explanation": explanation,
        "applied": applied_count,
        "total": len(actions),
    }


def _apply_calendar_action(action: dict, plans: list, assignments: list, user_id: str) -> bool:
    """Apply a single validated calendar action to the database."""
    action_type = action.get("action")

    if action_type == "create":
        # Create a new study session as a task in the relevant plan
        assignment_id = action.get("assignmentId")
        if not assignment_id:
            return False

        # Find or create a plan for this assignment
        plan = next((p for p in plans if p.get("assignmentId") == assignment_id), None)
        if not plan:
            # Create a new plan
            assignment = next((a for a in assignments if a["id"] == assignment_id), None)
            if not assignment:
                return False
            plan = {
                "id": generate_id(),
                "assignmentId": assignment_id,
                "assignmentTitle": assignment.get("title", ""),
                "module": assignment.get("module", ""),
                "totalDays": 1,
                "tasks": [],
                "estimatedHours": 0,
                "createdAt": datetime.utcnow().isoformat(),
            }

        new_task = {
            "id": f"task-{generate_id()}",
            "title": action.get("title", "Study session"),
            "scheduledDate": action.get("date", ""),
            "duration": action.get("duration", 60),
            "completed": False,
            "order": len(plan.get("tasks", [])) + 1,
        }
        plan.setdefault("tasks", []).append(new_task)
        plan["estimatedHours"] = round(sum(t.get("duration", 0) for t in plan["tasks"]) / 60, 2)
        put_item("study_plans", plan)
        return True

    elif action_type == "move":
        task_id = action.get("taskId")
        new_date = action.get("newDate")
        if not task_id or not new_date:
            return False

        for plan in plans:
            for task in plan.get("tasks", []):
                if task.get("id") == task_id:
                    task["scheduledDate"] = new_date
                    put_item("study_plans", plan)
                    return True
        return False

    elif action_type == "delete":
        task_id = action.get("taskId")
        if not task_id:
            return False

        for plan in plans:
            tasks = plan.get("tasks", [])
            original_len = len(tasks)
            plan["tasks"] = [t for t in tasks if t.get("id") != task_id]
            if len(plan["tasks"]) < original_len:
                put_item("study_plans", plan)
                return True
        return False

    elif action_type == "change_duration":
        task_id = action.get("taskId")
        duration = action.get("duration")
        if not task_id or not duration:
            return False

        for plan in plans:
            for task in plan.get("tasks", []):
                if task.get("id") == task_id:
                    task["duration"] = max(30, min(240, int(duration)))
                    put_item("study_plans", plan)
                    return True
        return False

    elif action_type == "reschedule":
        # Reschedule moves all tasks for an assignment
        assignment_id = action.get("assignmentId")
        new_date = action.get("date")
        if not assignment_id or not new_date:
            return False

        for plan in plans:
            if plan.get("assignmentId") == assignment_id:
                # Shift all incomplete tasks to start from new_date
                from datetime import date, timedelta
                start = date.fromisoformat(new_date)
                incomplete = [t for t in plan.get("tasks", []) if not t.get("completed")]
                for i, task in enumerate(incomplete):
                    task["scheduledDate"] = (start + timedelta(days=i)).isoformat()
                put_item("study_plans", plan)
                return True
        return False

    return False


# ---------------------------------------------------------------------------
# 3. Workload Balancing
# ---------------------------------------------------------------------------

@router.post("/workload-balance")
async def balance_workload(req: WorkloadBalanceRequest):
    """
    Retrieve user's assignments/plans, send to Gemini for balanced scheduling,
    validate the result, persist new study sessions to DynamoDB.
    """
    user_id = req.userId
    if not user_id:
        raise HTTPException(status_code=400, detail={"error": "userId is required"})

    # Get user's assignments and existing plans
    all_assignments = get_all("assignments")
    assignments = [a for a in all_assignments if a.get("userId") == user_id]

    all_plans = get_all("study_plans")
    user_assignment_ids = {a["id"] for a in assignments}
    user_plans = [p for p in all_plans if p.get("assignmentId") in user_assignment_ids]

    pending = [a for a in assignments if a.get("status") != "completed"]
    if not pending:
        return {
            "study_plan": [],
            "summary": "No pending assignments to schedule.",
            "totalHours": 0,
            "persisted": False,
        }

    try:
        result = await generate_workload_balance(
            assignments=pending,
            study_plans=user_plans,
            available_hours_per_day=3.0,
            horizon_days=req.horizonDays,
        )
    except GeminiError as e:
        raise HTTPException(status_code=503, detail={"error": str(e)})

    sessions = result.get("study_plan", [])
    summary = result.get("summary", "")
    total_hours = result.get("totalHours", 0)

    # Persist: create/update study plans with the new sessions
    persisted = False
    if sessions:
        # Group sessions by assignmentId
        by_assignment: dict[str, list] = {}
        for session in sessions:
            aid = session.get("assignmentId", "")
            by_assignment.setdefault(aid, []).append(session)

        for assignment_id, assignment_sessions in by_assignment.items():
            if not assignment_id:
                continue

            assignment = next((a for a in pending if a["id"] == assignment_id), None)
            if not assignment:
                continue

            # Find existing plan or create new one
            existing_plan = next((p for p in user_plans if p.get("assignmentId") == assignment_id), None)

            if existing_plan:
                # Add new tasks to existing plan (don't overwrite completed tasks)
                existing_tasks = existing_plan.get("tasks", [])
                max_order = max((t.get("order", 0) for t in existing_tasks), default=0)
                for i, session in enumerate(assignment_sessions):
                    existing_tasks.append({
                        "id": f"task-{generate_id()}",
                        "title": session.get("title", "Study session"),
                        "scheduledDate": session["date"],
                        "duration": session["duration_minutes"],
                        "completed": False,
                        "order": max_order + i + 1,
                    })
                existing_plan["estimatedHours"] = round(
                    sum(t.get("duration", 0) for t in existing_tasks) / 60, 2
                )
                put_item("study_plans", existing_plan)
            else:
                # Create new plan
                tasks = []
                for i, session in enumerate(assignment_sessions):
                    tasks.append({
                        "id": f"task-{generate_id()}",
                        "title": session.get("title", "Study session"),
                        "scheduledDate": session["date"],
                        "duration": session["duration_minutes"],
                        "completed": False,
                        "order": i + 1,
                    })
                new_plan = {
                    "id": generate_id(),
                    "assignmentId": assignment_id,
                    "assignmentTitle": assignment.get("title", ""),
                    "module": assignment.get("module", ""),
                    "totalDays": req.horizonDays,
                    "tasks": tasks,
                    "estimatedHours": round(sum(t["duration"] for t in tasks) / 60, 2),
                    "createdAt": datetime.utcnow().isoformat(),
                }
                put_item("study_plans", new_plan)

        persisted = True

        # Award XP
        award_xp(user_id, 15, "AI-generated balanced study plan")

    return {
        "study_plan": sessions,
        "summary": summary,
        "totalHours": total_hours,
        "persisted": persisted,
    }
