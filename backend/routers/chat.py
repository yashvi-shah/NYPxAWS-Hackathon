"""Chat endpoint — proxies messages to Gemini AI."""
from fastapi import APIRouter
from pydantic import BaseModel
from services.gemini import chat_completion

router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    context: str = ""


class ChatResponse(BaseModel):
    reply: str


@router.post("/chat")
async def chat(req: ChatRequest) -> ChatResponse:
    """Send a message to the AI and get a response."""
    reply = await chat_completion(req.message, req.context)
    return ChatResponse(reply=reply)
