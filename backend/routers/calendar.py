"""
Calendar Events — CRUD for user calendar events.
Separate from assignments/study-plans: these are explicit time-blocked events.
"""
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional
from services.dynamodb import get_all, get_by_id, put_item, delete_item, generate_id

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


class EventCreate(BaseModel):
    title: str = Field(..., min_length=1)
    date: str
    startTime: str = ""
    endTime: str = ""
    duration: int = 60
    category: str = "event"
    assignmentId: Optional[str] = None
    module: Optional[str] = None
    description: str = ""
    userId: str = ""
    color: Optional[str] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    duration: Optional[int] = None
    category: Optional[str] = None
    assignmentId: Optional[str] = None
    module: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


@router.get("/events")
async def list_events(userId: str = Query(""), month: str = Query("")):
    events = get_all("calendar_events")
    if userId:
        events = [e for e in events if e.get("userId") == userId]
    if month:
        events = [e for e in events if e.get("date", "").startswith(month)]
    events.sort(key=lambda e: (e.get("date", ""), e.get("startTime", "")))
    return events


@router.get("/events/{event_id}")
async def get_event(event_id: str):
    event = get_by_id("calendar_events", event_id)
    if not event:
        raise HTTPException(status_code=404, detail={"error": "Event not found"})
    return event


@router.post("/events", status_code=201)
async def create_event(req: EventCreate):
    if not req.userId:
        raise HTTPException(status_code=400, detail={"error": "userId is required"})
    event = {
        "id": generate_id(),
        "title": req.title,
        "date": req.date,
        "startTime": req.startTime,
        "endTime": req.endTime,
        "duration": req.duration,
        "category": req.category,
        "assignmentId": req.assignmentId,
        "module": req.module,
        "description": req.description,
        "userId": req.userId,
        "color": req.color,
        "createdAt": datetime.utcnow().isoformat(),
    }
    put_item("calendar_events", event)
    return event


@router.put("/events/{event_id}")
async def update_event(event_id: str, req: EventUpdate):
    event = get_by_id("calendar_events", event_id)
    if not event:
        raise HTTPException(status_code=404, detail={"error": "Event not found"})
    updates = req.dict(exclude_none=True)
    event.update(updates)
    event["updatedAt"] = datetime.utcnow().isoformat()
    put_item("calendar_events", event)
    return event


@router.delete("/events/{event_id}")
async def delete_event(event_id: str):
    delete_item("calendar_events", event_id)
    return {"success": True}


@router.post("/events/bulk", status_code=201)
async def create_events_bulk(events: list[EventCreate]):
    created = []
    for req in events:
        if not req.userId:
            continue
        event = {
            "id": generate_id(),
            "title": req.title,
            "date": req.date,
            "startTime": req.startTime,
            "endTime": req.endTime,
            "duration": req.duration,
            "category": req.category,
            "assignmentId": req.assignmentId,
            "module": req.module,
            "description": req.description,
            "userId": req.userId,
            "color": req.color,
            "createdAt": datetime.utcnow().isoformat(),
        }
        put_item("calendar_events", event)
        created.append(event)
    return {"created": len(created), "events": created}
