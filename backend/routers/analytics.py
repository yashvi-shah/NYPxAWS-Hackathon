"""Analytics & Recommendations — workload insights and priority-based suggestions."""
from fastapi import APIRouter, Query
from datetime import datetime, timedelta
from typing import Optional
from services.dynamodb import get_all, get_by_id
from services.priority import calculate_priority, get_priority_label

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/analytics")
async def get_analytics(userId: Optional[str] = Query(None)):
    """Workload analytics: completion stats, heatmap, weekly load, module breakdown."""
    all_assignments = get_all("assignments")
    assignments = [a for a in all_assignments if not userId or a.get("userId") == userId]

    completed = [a for a in assignments if a.get("status") == "completed"]
    pending = [a for a in assignments if a.get("status") != "completed"]

    # Heatmap (next 56 days)
    today = datetime.utcnow().date()
    heatmap = []
    for i in range(56):
        d = today + timedelta(days=i)
        date_str = d.isoformat()
        due_count = sum(1 for a in assignments if a.get("deadline", "").startswith(date_str))
        heatmap.append({"date": date_str, "count": due_count, "day": d.weekday()})

    # Weekly load (next 8 weeks)
    weekly_load = []
    for w in range(8):
        week_start = today + timedelta(weeks=w)
        week_end = week_start + timedelta(days=7)
        count = sum(
            1 for a in assignments
            if a.get("deadline") and week_start.isoformat() <= a["deadline"] < week_end.isoformat()
        )
        intensity = "none" if count == 0 else "low" if count <= 2 else "medium" if count <= 4 else "high"
        weekly_load.append({
            "week": f"Week {w + 1}",
            "startDate": week_start.isoformat(),
            "count": count,
            "intensity": intensity,
        })

    # Module breakdown
    modules = {}
    for a in assignments:
        mod = a.get("module", "Unknown")
        if mod not in modules:
            modules[mod] = {"total": 0, "completed": 0}
        modules[mod]["total"] += 1
        if a.get("status") == "completed":
            modules[mod]["completed"] += 1

    # User stats
    user = get_by_id("users", userId) if userId else None

    total = len(assignments)
    return {
        "totalAssignments": total,
        "completedAssignments": len(completed),
        "pendingAssignments": len(pending),
        "completionRate": round(len(completed) / total * 100) if total else 0,
        "averageProgress": round(sum(a.get("progress", 0) for a in pending) / len(pending)) if pending else 0,
        "heatmap": heatmap,
        "weeklyLoad": weekly_load,
        "moduleBreakdown": [{"name": k, **v} for k, v in modules.items()],
        "streak": user.get("streak", 0) if user else 0,
        "xpHistory": (user.get("xpHistory") or [])[-20:] if user else [],
    }


@router.get("/recommendations")
async def get_recommendations(userId: Optional[str] = Query(None)):
    """Top 3 priority recommendations for a user."""
    all_assignments = get_all("assignments")
    assignments = [a for a in all_assignments if not userId or a.get("userId") == userId]
    pending = [a for a in assignments if a.get("status") != "completed"]

    # Score and sort
    scored = []
    for a in pending:
        score = calculate_priority(a)
        scored.append((score, a))
    scored.sort(key=lambda x: x[0], reverse=True)

    # Top 3 recommendations
    recommendations = []
    for i, (score, a) in enumerate(scored[:3]):
        days_left = 0
        try:
            deadline = datetime.fromisoformat(a.get("deadline", ""))
            days_left = max(0, (deadline - datetime.utcnow()).days)
        except ValueError:
            pass

        if days_left <= 1:
            action = "Start immediately"
        elif days_left <= 3:
            action = "Begin today"
        elif a.get("progress", 0) == 0:
            action = "Start working on this"
        else:
            action = "Continue making progress"

        recommendations.append({
            "rank": i + 1,
            "assignment": {**a, "priorityScore": score, "priorityLabel": get_priority_label(score)},
            "reason": f"Priority score {score}/100 — {get_priority_label(score)}",
            "suggestedAction": action,
        })

    return recommendations
