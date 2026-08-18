from pydantic import BaseModel
from typing import Optional


class PlanTask(BaseModel):
    id: str
    title: str
    scheduledDate: str
    duration: int  # minutes
    completed: bool = False
    order: int = 0


class StudyPlanResponse(BaseModel):
    id: str
    assignmentId: str
    assignmentTitle: str
    module: str
    totalDays: int
    tasks: list[PlanTask] = []
    estimatedHours: float = 0
    createdAt: str = ""


class GeneratePlanRequest(BaseModel):
    assignmentId: str
    userId: str


class UpdateTaskRequest(BaseModel):
    completed: bool
    userId: Optional[str] = None
