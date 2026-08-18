"""Gamification: Leaderboard & Badges."""
from fastapi import APIRouter
from services.dynamodb import get_all, calculate_level

router = APIRouter(prefix="/api", tags=["gamification"])

# Badge catalog — matches the original server.js hardcoded list
BADGES = [
    {"id": "first-assignment", "name": "First Steps", "description": "Add your first assignment", "icon": "target", "xpReward": 25},
    {"id": "streak-3", "name": "On Fire", "description": "3-day study streak", "icon": "flame", "xpReward": 50},
    {"id": "streak-7", "name": "Unstoppable", "description": "7-day study streak", "icon": "zap", "xpReward": 100},
    {"id": "early-bird", "name": "Early Bird", "description": "Submit an assignment early", "icon": "clock", "xpReward": 75},
    {"id": "helper", "name": "Helpful Hand", "description": "Help 3 peers", "icon": "users", "xpReward": 75},
    {"id": "planner", "name": "Master Planner", "description": "Generate 3 study plans", "icon": "plans", "xpReward": 50},
    {"id": "all-clear", "name": "All Clear", "description": "Complete all assignments in a week", "icon": "checkCircle", "xpReward": 100},
    {"id": "social", "name": "Community Star", "description": "Start 5 discussions", "icon": "message", "xpReward": 50},
    {"id": "level-5", "name": "Rising Scholar", "description": "Reach Level 5", "icon": "book", "xpReward": 75},
    {"id": "level-10", "name": "Academic Hero", "description": "Reach Level 10", "icon": "award", "xpReward": 150},
]


@router.get("/leaderboard")
async def leaderboard():
    users = get_all("users")
    board = []
    for u in users:
        board.append({
            "id": u["id"],
            "name": u.get("name", ""),
            "avatar": u.get("avatar", ""),
            "course": u.get("course", ""),
            "xp": u.get("xp", 0),
            "streak": u.get("streak", 0),
            "levelInfo": calculate_level(u.get("xp", 0)),
        })
    board.sort(key=lambda x: x["xp"], reverse=True)
    return board


@router.get("/badges")
async def badges():
    return BADGES
