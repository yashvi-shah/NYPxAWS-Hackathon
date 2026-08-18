"""Assignment CRUD — preserves existing frontend contract."""
from fastapi import APIRouter, HTTPException
from datetime import datetime
from models.assignment import AssignmentCreate, AssignmentUpdate
from services.dynamodb import get_all, get_by_id, put_item, delete_item, generate_id, award_xp
from services.priority import enrich_assignment

router = APIRouter(prefix="/api", tags=["assignments"])


@router.get("/assignments")
async def list_assignments():
    """Return all assignments with priority scores. Frontend filters by userId."""
    assignments = get_all("assignments")
    enriched = [enrich_assignment(a) for a in assignments]
    enriched.sort(key=lambda a: a.get("priorityScore", 0), reverse=True)
    return enriched


@router.post("/assignments", status_code=201)
async def create_assignment(req: AssignmentCreate):
    assignment = {
        "id": generate_id(),
        "title": req.title,
        "module": req.module,
        "type": req.type,
        "deadline": req.deadline,
        "weightage": req.weightage,
        "confidence": req.confidence,
        "progress": req.progress,
        "status": "pending",
        "description": req.description,
        "userId": req.userId,
        "createdAt": datetime.utcnow().isoformat(),
    }
    put_item("assignments", assignment)

    # Award XP
    if req.userId:
        award_xp(req.userId, 10, "Added new assignment")

    return enrich_assignment(assignment)


@router.put("/assignments/{assignment_id}")
async def update_assignment(assignment_id: str, body: dict):
    assignment = get_by_id("assignments", assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail={"error": "Not found"})

    old_status = assignment.get("status")
    old_progress = assignment.get("progress", 0)
    assignment.update(body)
    assignment["updatedAt"] = datetime.utcnow().isoformat()
    put_item("assignments", assignment)

    user_id = body.get("userId") or assignment.get("userId")

    # XP for completion
    if body.get("status") == "completed" and old_status != "completed" and user_id:
        deadline = datetime.fromisoformat(assignment.get("deadline", datetime.utcnow().isoformat()))
        now = datetime.utcnow()
        early_bonus = 25 if deadline > now else 0
        late_penalty = -15 if now > deadline else 0
        reason = f"Completed: {assignment['title']}"
        if early_bonus:
            reason += " (early bonus!)"
        if late_penalty:
            reason += " (late penalty)"
        award_xp(user_id, 50 + early_bonus + late_penalty, reason)

    # XP for progress updates
    new_progress = body.get("progress")
    if new_progress and user_id and new_progress > old_progress:
        award_xp(user_id, 5, f"Progress on: {assignment['title']}")

    return enrich_assignment(assignment)


@router.delete("/assignments/{assignment_id}")
async def delete_assignment_endpoint(assignment_id: str):
    delete_item("assignments", assignment_id)
    return {"success": True}
