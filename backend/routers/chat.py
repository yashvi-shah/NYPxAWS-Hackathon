"""Chat endpoint — proxies messages to Gemini AI."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.gemini import chat_completion, GeminiError

router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    context: str = ""


class ChatResponse(BaseModel):
    reply: str


@router.post("/chat")
async def chat(req: ChatRequest) -> ChatResponse:
    """Send a message to the AI and get a response."""
    try:
        reply = await chat_completion(req.message, req.context)
        return ChatResponse(reply=reply)
    except GeminiError as e:
        raise HTTPException(status_code=503, detail={"error": str(e)})
