"""Pydantic models for AI-powered features: flashcards, calendar actions, workload balancing."""
from pydantic import BaseModel, Field
from typing import Optional


# ---------------------------------------------------------------------------
# Flashcards
# ---------------------------------------------------------------------------

class Flashcard(BaseModel):
    question: str
    answer: str
    difficulty: str = "medium"  # easy, medium, hard
    topic: str = ""


class FlashcardGenerateRequest(BaseModel):
    material: str = Field(..., min_length=10, description="Study material to generate flashcards from")
    topic: str = ""
    count: int = Field(default=5, ge=1, le=20)
    userId: str = ""


class FlashcardSet(BaseModel):
    id: str = ""
    userId: str = ""
    topic: str = ""
    cards: list[Flashcard] = []
    createdAt: str = ""


# ---------------------------------------------------------------------------
# Calendar / Study Plan Actions
# ---------------------------------------------------------------------------

class CalendarAction(BaseModel):
    action: str  # create, move, delete, change_duration, change_priority, reschedule
    taskId: Optional[str] = None
    assignmentId: Optional[str] = None
    date: Optional[str] = None
    newDate: Optional[str] = None
    duration: Optional[int] = None  # minutes
    priority: Optional[str] = None
    title: Optional[str] = None
    reason: str = ""


class CalendarActionRequest(BaseModel):
    userRequest: str = Field(..., min_length=3, description="Natural language request from the user")
    userId: str = ""


class CalendarActionResponse(BaseModel):
    actions: list[CalendarAction] = []
    explanation: str = ""
    applied: bool = False


# ---------------------------------------------------------------------------
# Workload Balancing
# ---------------------------------------------------------------------------

class StudySession(BaseModel):
    date: str
    taskId: str = ""
    assignmentId: str = ""
    title: str = ""
    duration_minutes: int = 60
    reason: str = ""


class WorkloadBalanceRequest(BaseModel):
    userId: str
    horizonDays: int = Field(default=14, ge=1, le=60)


class WorkloadBalanceResponse(BaseModel):
    study_plan: list[StudySession] = []
    summary: str = ""
    totalHours: float = 0
    persisted: bool = False
