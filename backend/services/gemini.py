"""
Gemini AI service — handles all AI-powered features.
Never exposes the API key to the frontend.
All Gemini output is treated as untrusted and validated before use.
"""
import json
import re
from typing import Optional
from config import get_settings

settings = get_settings()

_model = None


class GeminiError(Exception):
    """Raised when Gemini is unavailable or returns invalid data."""
    pass


def get_model():
    """Lazy-init the Gemini model."""
    global _model
    if _model is None:
        if not settings.gemini_api_key:
            return None
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        _model = genai.GenerativeModel("gemini-3.6-flash")
    return _model


def _extract_json(text: str) -> Optional[dict | list]:
    """Extract JSON from Gemini response, handling markdown code blocks."""
    # Try to find JSON in code blocks first
    code_block = re.search(r"```(?:json)?\s*\n?([\s\S]*?)\n?```", text)
    if code_block:
        text = code_block.group(1).strip()

    # Try parsing directly
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try finding JSON array or object
    for pattern in [r"\[[\s\S]*\]", r"\{[\s\S]*\}"]:
        match = re.search(pattern, text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                continue

    return None


# ---------------------------------------------------------------------------
# Chat (existing functionality, preserved)
# ---------------------------------------------------------------------------

async def chat_completion(message: str, context: str = "") -> str:
    """Send a message to Gemini and return the response text."""
    model = get_model()
    if not model:
        raise GeminiError("GEMINI_API_KEY is not configured. Set it in the backend .env file.")

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
        raise GeminiError(f"Gemini API error: {str(e)}")


# ---------------------------------------------------------------------------
# Flashcard Generation
# ---------------------------------------------------------------------------

async def generate_flashcards(material: str, topic: str = "", count: int = 5) -> list[dict]:
    """
    Generate flashcards from study material using Gemini.
    Returns validated list of flashcard dicts.
    """
    model = get_model()
    if not model:
        raise GeminiError("GEMINI_API_KEY is not configured. Set it in the backend .env file.")

    prompt = f"""You are an academic flashcard generator for polytechnic students.

Given the following study material, generate exactly {count} flashcards.

STUDY MATERIAL:
{material}

{"TOPIC: " + topic if topic else ""}

Return ONLY a JSON array with this exact structure (no other text):
[
  {{
    "question": "Clear, specific question testing understanding",
    "answer": "Concise, accurate answer",
    "difficulty": "easy|medium|hard",
    "topic": "Specific subtopic this covers"
  }}
]

Rules:
- Questions should test understanding, not just recall
- Answers should be concise but complete
- Difficulty should reflect how complex the concept is
- Topic should be a specific subtopic from the material
- Generate exactly {count} flashcards
- Return ONLY valid JSON, no markdown, no explanation"""

    try:
        response = model.generate_content(prompt)
        parsed = _extract_json(response.text)

        if not isinstance(parsed, list):
            raise GeminiError("Gemini returned invalid flashcard format (not a list)")

        # Validate each flashcard
        validated = []
        for card in parsed[:count]:
            if not isinstance(card, dict):
                continue
            validated.append({
                "question": str(card.get("question", "")).strip(),
                "answer": str(card.get("answer", "")).strip(),
                "difficulty": str(card.get("difficulty", "medium")).lower().strip(),
                "topic": str(card.get("topic", topic)).strip(),
            })

        if not validated:
            raise GeminiError("Gemini returned no valid flashcards")

        # Ensure difficulty is valid
        for card in validated:
            if card["difficulty"] not in ("easy", "medium", "hard"):
                card["difficulty"] = "medium"

        return validated

    except GeminiError:
        raise
    except Exception as e:
        raise GeminiError(f"Flashcard generation failed: {str(e)}")


# ---------------------------------------------------------------------------
# Calendar / Study Plan Actions
# ---------------------------------------------------------------------------

async def generate_calendar_actions(
    user_request: str,
    assignments: list[dict],
    study_plans: list[dict],
) -> dict:
    """
    Parse a natural language request into structured calendar actions.
    Returns validated action list + explanation.
    """
    model = get_model()
    if not model:
        raise GeminiError("GEMINI_API_KEY is not configured. Set it in the backend .env file.")

    # Build context about user's current schedule
    assignments_context = json.dumps([
        {"id": a["id"], "title": a.get("title", ""), "deadline": a.get("deadline", ""),
         "module": a.get("module", ""), "progress": a.get("progress", 0), "status": a.get("status", "")}
        for a in assignments[:15]
    ], indent=2)

    plans_context = json.dumps([
        {"id": p["id"], "assignmentId": p.get("assignmentId", ""), "assignmentTitle": p.get("assignmentTitle", ""),
         "tasks": [{"id": t.get("id", ""), "title": t.get("title", ""), "scheduledDate": t.get("scheduledDate", ""),
                    "duration": t.get("duration", 0), "completed": t.get("completed", False)}
                   for t in p.get("tasks", [])[:10]]}
        for p in study_plans[:10]
    ], indent=2)

    prompt = f"""You are a study schedule assistant. Parse the user's request into structured actions.

CURRENT ASSIGNMENTS:
{assignments_context}

CURRENT STUDY PLANS:
{plans_context}

USER REQUEST: "{user_request}"

Return ONLY a JSON object with this structure (no other text):
{{
  "actions": [
    {{
      "action": "create|move|delete|change_duration|change_priority|reschedule",
      "taskId": "existing task ID if modifying, or null for new",
      "assignmentId": "related assignment ID",
      "date": "YYYY-MM-DD for the session",
      "newDate": "YYYY-MM-DD if moving (null otherwise)",
      "duration": minutes as integer (30-240),
      "priority": "high|medium|low or null",
      "title": "task title for new sessions",
      "reason": "brief explanation"
    }}
  ],
  "explanation": "Plain English summary of what these actions do"
}}

Rules:
- Only propose actions that make sense given the data
- Dates must be in YYYY-MM-DD format and not in the past
- Duration must be between 30 and 240 minutes
- action must be one of: create, move, delete, change_duration, change_priority, reschedule
- Return ONLY valid JSON"""

    try:
        response = model.generate_content(prompt)
        parsed = _extract_json(response.text)

        if not isinstance(parsed, dict):
            raise GeminiError("Gemini returned invalid calendar action format")

        actions = parsed.get("actions", [])
        explanation = str(parsed.get("explanation", ""))

        # Validate each action
        valid_actions_types = {"create", "move", "delete", "change_duration", "change_priority", "reschedule"}
        validated_actions = []

        for action in actions:
            if not isinstance(action, dict):
                continue
            action_type = str(action.get("action", "")).lower().strip()
            if action_type not in valid_actions_types:
                continue

            # Validate duration
            duration = action.get("duration")
            if duration is not None:
                duration = max(30, min(240, int(duration)))

            validated_actions.append({
                "action": action_type,
                "taskId": action.get("taskId"),
                "assignmentId": action.get("assignmentId"),
                "date": action.get("date"),
                "newDate": action.get("newDate"),
                "duration": duration,
                "priority": action.get("priority"),
                "title": action.get("title"),
                "reason": str(action.get("reason", "")),
            })

        return {"actions": validated_actions, "explanation": explanation}

    except GeminiError:
        raise
    except Exception as e:
        raise GeminiError(f"Calendar action generation failed: {str(e)}")


# ---------------------------------------------------------------------------
# Workload Balancing
# ---------------------------------------------------------------------------

async def generate_workload_balance(
    assignments: list[dict],
    study_plans: list[dict],
    available_hours_per_day: float = 3.0,
    horizon_days: int = 14,
) -> dict:
    """
    Generate a balanced study plan across the given horizon.
    Returns validated study sessions + summary.
    """
    model = get_model()
    if not model:
        raise GeminiError("GEMINI_API_KEY is not configured. Set it in the backend .env file.")

    from datetime import datetime, timedelta
    today = datetime.utcnow().date()
    dates_available = [(today + timedelta(days=i)).isoformat() for i in range(horizon_days)]

    # Build context
    assignments_context = json.dumps([
        {"id": a["id"], "title": a.get("title", ""), "deadline": a.get("deadline", ""),
         "module": a.get("module", ""), "weightage": a.get("weightage", 0),
         "progress": a.get("progress", 0), "confidence": a.get("confidence", 50),
         "type": a.get("type", ""), "status": a.get("status", "")}
        for a in assignments if a.get("status") != "completed"
    ], indent=2)

    existing_sessions = []
    for plan in study_plans:
        for task in plan.get("tasks", []):
            if not task.get("completed"):
                existing_sessions.append({
                    "planId": plan["id"],
                    "taskId": task.get("id", ""),
                    "title": task.get("title", ""),
                    "date": task.get("scheduledDate", ""),
                    "duration": task.get("duration", 60),
                    "assignmentId": plan.get("assignmentId", ""),
                })
    sessions_context = json.dumps(existing_sessions[:30], indent=2)

    prompt = f"""You are a workload balancing AI for a polytechnic student.

TODAY: {today.isoformat()}
AVAILABLE DATES: {dates_available[0]} to {dates_available[-1]}
AVAILABLE HOURS PER DAY: {available_hours_per_day}

PENDING ASSIGNMENTS:
{assignments_context}

EXISTING SCHEDULED SESSIONS:
{sessions_context}

Generate an optimized study plan. Return ONLY a JSON object:
{{
  "study_plan": [
    {{
      "date": "YYYY-MM-DD",
      "assignmentId": "assignment ID",
      "title": "What to work on",
      "duration_minutes": 60,
      "reason": "Why this is scheduled here"
    }}
  ],
  "summary": "Brief overview of the plan"
}}

Rules:
- Prioritize assignments with nearest deadlines and highest weightage
- Never schedule work after its deadline
- Don't exceed {available_hours_per_day} hours of study per day
- Distribute large assignments across multiple sessions
- Leave buffer time (1-2 days) before deadlines for review
- Sessions should be 30-120 minutes (focused study blocks)
- Include the reason for each scheduling decision
- Don't schedule sessions on dates before today
- Consider existing sessions to avoid conflicts
- Return ONLY valid JSON"""

    try:
        response = model.generate_content(prompt)
        parsed = _extract_json(response.text)

        if not isinstance(parsed, dict):
            raise GeminiError("Gemini returned invalid workload balance format")

        sessions = parsed.get("study_plan", [])
        summary = str(parsed.get("summary", ""))

        # Validate sessions
        validated = []
        max_minutes_per_day = int(available_hours_per_day * 60)
        day_totals: dict[str, int] = {}

        for session in sessions:
            if not isinstance(session, dict):
                continue

            date_str = str(session.get("date", ""))
            # Validate date format and range
            try:
                from datetime import date as date_type
                session_date = date_type.fromisoformat(date_str)
                if session_date < today:
                    continue  # Skip past dates
            except (ValueError, TypeError):
                continue

            duration = session.get("duration_minutes", 60)
            duration = max(30, min(120, int(duration)))

            # Check daily limit
            current_day_total = day_totals.get(date_str, 0)
            if current_day_total + duration > max_minutes_per_day:
                continue  # Would exceed daily limit

            day_totals[date_str] = current_day_total + duration

            validated.append({
                "date": date_str,
                "assignmentId": str(session.get("assignmentId", "")),
                "title": str(session.get("title", "")),
                "duration_minutes": duration,
                "reason": str(session.get("reason", "")),
            })

        total_hours = round(sum(s["duration_minutes"] for s in validated) / 60, 1)

        return {
            "study_plan": validated,
            "summary": summary,
            "totalHours": total_hours,
        }

    except GeminiError:
        raise
    except Exception as e:
        raise GeminiError(f"Workload balancing failed: {str(e)}")
