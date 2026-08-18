"""
Gemini AI service — handles all AI-powered features.
Never exposes the API key to the frontend.
"""
from config import get_settings

settings = get_settings()

_model = None


def get_model():
    """Lazy-init the Gemini model."""
    global _model
    if _model is None and settings.gemini_api_key:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        _model = genai.GenerativeModel("gemini-1.5-flash")
    return _model


async def chat_completion(message: str, context: str = "") -> str:
    """Send a message to Gemini and return the response text."""
    model = get_model()
    if not model:
        return "AI is not configured. Please set GEMINI_API_KEY in your environment."

    system_prompt = (
        "You are Gravity AI, a helpful academic assistant for polytechnic students. "
        "You help with study planning, workload management, flashcard creation, "
        "and deadline prioritisation. Keep responses concise and actionable."
    )
    full_prompt = f"{system_prompt}\n\nContext: {context}\n\nStudent: {message}"

    try:
        response = model.generate_content(full_prompt)
        return response.text
    except Exception as e:
        return f"I couldn't process that right now. Error: {str(e)}"


async def generate_study_plan_ai(assignment: dict) -> list[dict]:
    """Use Gemini to generate a smarter study plan (future enhancement)."""
    # For now, return None to signal that the fallback generator should be used
    # When Gemini is configured, this can produce better task breakdowns
    model = get_model()
    if not model:
        return []
    # TODO: Implement AI-powered plan generation
    return []
