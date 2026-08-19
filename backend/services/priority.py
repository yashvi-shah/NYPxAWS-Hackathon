"""
Priority scoring engine — determines which assignments need attention first.
Mirrors the logic from the original Node.js server.
"""
from datetime import datetime
import math


def calculate_priority(assignment: dict) -> int:
    """Calculate priority score 0-100 based on deadline, weightage, confidence, progress."""
    deadline_str = assignment.get("deadline", "")
    if not deadline_str:
        return 0

    try:
        deadline = datetime.fromisoformat(deadline_str)
    except ValueError:
        return 0

    now = datetime.utcnow()
    days_until_due = max(0, (deadline - now).total_seconds() / 86400)

    score = 0

    # Deadline urgency (0-40 points)
    if days_until_due <= 1:
        score += 40
    elif days_until_due <= 3:
        score += 35
    elif days_until_due <= 7:
        score += 25
    elif days_until_due <= 14:
        score += 15
    else:
        score += 5

    # Weightage (0-25 points)
    weightage = assignment.get("weightage", 10)
    score += weightage * 0.25 * 5

    # Confidence inverse (0-20 points)
    confidence = assignment.get("confidence", 50)
    score += (100 - confidence) * 0.2

    # Progress inverse (0-15 points)
    progress = assignment.get("progress", 0)
    score += (100 - progress) * 0.15

    return min(100, round(score))


def get_priority_label(score: int) -> str:
    if score >= 75:
        return "Critical"
    if score >= 50:
        return "High"
    if score >= 25:
        return "Medium"
    return "Low"


def get_priority_color(score: int) -> str:
    if score >= 75:
        return "#ef4444"
    if score >= 50:
        return "#f97316"
    if score >= 25:
        return "#eab308"
    return "#22c55e"


def enrich_assignment(assignment: dict) -> dict:
    """Add priority fields to an assignment."""
    score = calculate_priority(assignment)
    return {
        **assignment,
        "priorityScore": score,
        "priorityLabel": get_priority_label(score),
        "priorityColor": get_priority_color(score),
    }
