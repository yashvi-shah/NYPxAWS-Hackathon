from pydantic import BaseModel
from typing import Optional


class AssignmentCreate(BaseModel):
    title: str
    module: str
    type: str = "Default"
    deadline: str
    weightage: int = 10
    confidence: int = 50
    progress: int = 0
    description: str = ""
    userId: str


class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    module: Optional[str] = None
    type: Optional[str] = None
    deadline: Optional[str] = None
    weightage: Optional[int] = None
    confidence: Optional[int] = None
    progress: Optional[int] = None
    status: Optional[str] = None
    description: Optional[str] = None
    userId: Optional[str] = None


class AssignmentResponse(BaseModel):
    id: str
    title: str
    module: str
    type: str
    deadline: str
    weightage: int
    confidence: int
    progress: int
    status: str
    description: str
    userId: str
    priorityScore: int = 0
    priorityLabel: str = ""
    priorityColor: str = ""
    createdAt: str = ""
