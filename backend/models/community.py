from pydantic import BaseModel
from typing import Optional


class HelpResponse(BaseModel):
    userId: str
    userName: str
    message: str
    date: str = ""


class HelpRequestCreate(BaseModel):
    title: str
    description: str
    category: str = "Academic"
    module: str = ""
    urgency: str = "medium"
    userId: str
    userName: str


class HelpRequestResponse(BaseModel):
    id: str
    title: str
    description: str
    category: str
    module: str
    urgency: str
    userId: str
    userName: str
    status: str = "open"
    responses: list[HelpResponse] = []
    createdAt: str = ""


class RespondRequest(BaseModel):
    userId: str
    userName: str
    message: str


class DiscussionReply(BaseModel):
    userId: str
    userName: str
    content: str
    date: str = ""


class DiscussionCreate(BaseModel):
    title: str
    content: str
    module: str = ""
    tags: list[str] = []
    userId: str
    userName: str


class DiscussionResponse(BaseModel):
    id: str
    title: str
    content: str
    module: str
    tags: list[str] = []
    userId: str
    userName: str
    replies: list[DiscussionReply] = []
    upvotes: int = 0
    createdAt: str = ""


class ReplyRequest(BaseModel):
    userId: str
    userName: str
    content: str
