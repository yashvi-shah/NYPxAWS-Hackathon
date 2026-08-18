"""Study Plans — generate AI-powered plans and track task completion."""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
import math
from models.study_plan import GeneratePlanRequest, UpdateTaskRequest
from services.dynamodb import get_all, get_by_id, put_item, generate_id, award_xp

router = APIRouter(prefix="/api", tags=["study-plans"])

# Task templates by assignment type
TASK_TEMPLATES = {
    "Essay": ["Research topic & gather sources", "Create outline", "Write introduction", "Write body paragraphs", "Write conclusion", "Proofread & format"],
    "Programming": ["Understand requirements", "Design solution architecture", "Set up project structure", "Implement core features", "Testing & debugging", "Documentation & submission"],
    "Report": ["Research & data collection", "Analyze findings", "Create structure/outline", "Write draft", "Add visuals/charts", "Review & finalize"],
    "Presentation": ["Research content", "Create slide outline", "Design slides", "Add visuals & animations", "Practice delivery", "Final review"],
    "Lab Report": ["Review lab procedures", "Organize data & observations", "Write methodology", "Analyze results", "Write discussion & conclusion", "Format & references"],
    "Project": ["Define scope & objectives", "Research & planning", "Initial development", "Core implementation", "Testing & iteration", "Final submission prep"],
    "Default": ["Understand requirements", "Research & planning", "Initial draft/work", "Development/writing", "Review & refine", "Final submission"],
}


def generate_plan_tasks(assignment: dict) -> dict:
    """Generate a study plan from an assignment using the template engine."""
    now = datetime.utcnow()
    deadline_str = assignment.get("deadline", "")
    try:
        deadline = datetime.fromisoformat(deadline_str)
    except ValueError:
        deadline = now + timedelta(days=7)

    days_available = max(1, math.ceil((deadline - now).total_seconds() / 86400))
    template = TASK_TEMPLATES.get(assignment.get("type", ""), TASK_TEMPLATES["Default"])

    tasks = []
    for i, task_title in enumerate(template):
        task_date = now + timedelta(days=int(i * days_available / len(template)))
        duration = max(30, round(120 / len(template) * (assignment.get("weightage", 10) / 10)))
        tasks.append({
            "id": f"task-{i}",
            "title": task_title,
            "scheduledDate": task_date.strftime("%Y-%m-%d"),
            "duration": duration,
            "completed": False,
            "order": i + 1,
        })

    return {
        "assignmentId": assignment["id"],
        "assignmentTitle": assignment.get("title", ""),
        "module": assignment.get("module", ""),
        "totalDays": days_available,
        "tasks": tasks,
        "estimatedHours": round(sum(t["duration"] for t in tasks) / 60, 2),
    }


@router.get("/study-plans")
async def list_plans():
    """Return all study plans. Frontend filters by assignment ownership."""
    return get_all("study_plans")


@router.post("/study-plans/generate", status_code=201)
async def generate_plan(req: GeneratePlanRequest):
    assignment = get_by_id("assignments", req.assignmentId)
    if not assignment:
        raise HTTPException(status_code=404, detail={"error": "Assignment not found"})

    plan_data = generate_plan_tasks(assignment)
    plan_data["id"] = generate_id()
    plan_data["createdAt"] = datetime.utcnow().isoformat()
    put_item("study_plans", plan_data)

    if req.userId:
        award_xp(req.userId, 15, "Generated study plan")

    return plan_data


@router.put("/study-plans/{plan_id}/tasks/{task_id}")
async def update_task(plan_id: str, task_id: str, req: UpdateTaskRequest):
    plan = get_by_id("study_plans", plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail={"error": "Plan not found"})

    task = next((t for t in plan.get("tasks", []) if t.get("id") == task_id), None)
    if task:
        task["completed"] = req.completed
        put_item("study_plans", plan)
        if req.completed and req.userId:
            award_xp(req.userId, 10, f"Completed task: {task['title']}")

    return plan
