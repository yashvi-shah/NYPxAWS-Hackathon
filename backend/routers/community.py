"""Community: Help Requests & Discussions."""
from fastapi import APIRouter, HTTPException
from datetime import datetime
from models.community import (
    HelpRequestCreate, RespondRequest,
    DiscussionCreate, ReplyRequest,
)
from services.dynamodb import get_all, get_by_id, put_item, generate_id, award_xp

router = APIRouter(prefix="/api", tags=["community"])


# --------------------------------------------------------------------------
# Help Requests
# --------------------------------------------------------------------------

@router.get("/help-requests")
async def list_help_requests():
    items = get_all("help_requests")
    items.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return items


@router.post("/help-requests", status_code=201)
async def create_help_request(req: HelpRequestCreate):
    item = {
        "id": generate_id(),
        "title": req.title,
        "description": req.description,
        "category": req.category,
        "module": req.module,
        "urgency": req.urgency,
        "userId": req.userId,
        "userName": req.userName,
        "status": "open",
        "responses": [],
        "createdAt": datetime.utcnow().isoformat(),
    }
    put_item("help_requests", item)
    if req.userId:
        award_xp(req.userId, 5, "Posted help request")
    return item


@router.post("/help-requests/{request_id}/respond")
async def respond_to_help_request(request_id: str, req: RespondRequest):
    item = get_by_id("help_requests", request_id)
    if not item:
        raise HTTPException(status_code=404, detail={"error": "Not found"})

    response = {
        "userId": req.userId,
        "userName": req.userName,
        "message": req.message,
        "date": datetime.utcnow().isoformat(),
    }
    if "responses" not in item:
        item["responses"] = []
    item["responses"].append(response)
    put_item("help_requests", item)

    if req.userId:
        award_xp(req.userId, 20, "Helped a peer")

    return item


# --------------------------------------------------------------------------
# Discussions
# --------------------------------------------------------------------------

@router.get("/discussions")
async def list_discussions():
    items = get_all("discussions")
    items.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return items


@router.post("/discussions", status_code=201)
async def create_discussion(req: DiscussionCreate):
    item = {
        "id": generate_id(),
        "title": req.title,
        "content": req.content,
        "module": req.module,
        "tags": req.tags,
        "userId": req.userId,
        "userName": req.userName,
        "replies": [],
        "upvotes": 0,
        "createdAt": datetime.utcnow().isoformat(),
    }
    put_item("discussions", item)
    if req.userId:
        award_xp(req.userId, 5, "Started a discussion")
    return item


@router.post("/discussions/{discussion_id}/reply")
async def reply_to_discussion(discussion_id: str, req: ReplyRequest):
    item = get_by_id("discussions", discussion_id)
    if not item:
        raise HTTPException(status_code=404, detail={"error": "Not found"})

    reply = {
        "userId": req.userId,
        "userName": req.userName,
        "content": req.content,
        "date": datetime.utcnow().isoformat(),
    }
    if "replies" not in item:
        item["replies"] = []
    item["replies"].append(reply)
    put_item("discussions", item)

    if req.userId:
        award_xp(req.userId, 10, "Replied to discussion")

    return item
