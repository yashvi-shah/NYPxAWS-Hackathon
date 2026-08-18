"""Auth & User endpoints — preserves the existing frontend API contract."""
from fastapi import APIRouter, HTTPException
from datetime import datetime
from models.user import LoginRequest, UserCreate, UserResponse, RedeemRequest
from services.dynamodb import (
    get_all, get_by_id, put_item, generate_id, calculate_level, award_xp,
)

router = APIRouter(prefix="/api", tags=["auth", "users"])


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------

@router.post("/auth/login")
async def login(req: LoginRequest):
    users = get_all("users")
    user = next((u for u in users if u.get("email") == req.email), None)
    if not user or user.get("password") != req.password:
        raise HTTPException(status_code=401, detail={"success": False, "error": "Invalid credentials"})

    safe = {k: v for k, v in user.items() if k != "password"}
    safe["levelInfo"] = calculate_level(user.get("xp", 0))
    return {"success": True, "user": safe}


@router.post("/auth/register", status_code=201)
async def register(req: UserCreate):
    users = get_all("users")
    if any(u.get("email") == req.email for u in users):
        raise HTTPException(status_code=400, detail={"success": False, "error": "Email already exists"})

    user = {
        "id": generate_id(),
        "name": req.name,
        "email": req.email,
        "password": req.password,
        "course": req.course,
        "year": req.year,
        "xp": 0,
        "streak": 0,
        "lastActiveDate": datetime.utcnow().date().isoformat(),
        "avatar": req.avatar or "",
        "badges": [],
        "xpHistory": [],
        "createdAt": datetime.utcnow().isoformat(),
    }
    put_item("users", user)
    safe = {k: v for k, v in user.items() if k != "password"}
    return {"success": True, "user": safe}


# --------------------------------------------------------------------------
# Users
# --------------------------------------------------------------------------

@router.get("/users")
async def list_users():
    users = get_all("users")
    result = []
    for u in users:
        safe = {k: v for k, v in u.items() if k != "password"}
        safe["levelInfo"] = calculate_level(u.get("xp", 0))
        result.append(safe)
    return result


@router.get("/users/{user_id}")
async def get_user(user_id: str):
    user = get_by_id("users", user_id)
    if not user:
        raise HTTPException(status_code=404, detail={"error": "User not found"})
    safe = {k: v for k, v in user.items() if k != "password"}
    safe["levelInfo"] = calculate_level(user.get("xp", 0))
    return safe


@router.put("/users/{user_id}")
async def update_user(user_id: str, body: dict):
    user = get_by_id("users", user_id)
    if not user:
        raise HTTPException(status_code=404, detail={"error": "User not found"})
    user.update(body)
    user["updatedAt"] = datetime.utcnow().isoformat()
    put_item("users", user)
    safe = {k: v for k, v in user.items() if k != "password"}
    safe["levelInfo"] = calculate_level(user.get("xp", 0))
    return safe


# --------------------------------------------------------------------------
# Rewards
# --------------------------------------------------------------------------

@router.post("/rewards/redeem")
async def redeem_reward(req: RedeemRequest):
    user = get_by_id("users", req.userId)
    if not user:
        raise HTTPException(status_code=404, detail={"error": "User not found"})
    if (user.get("xp") or 0) < req.xpCost:
        raise HTTPException(status_code=400, detail={"error": "Not enough XP"})

    user["xp"] = (user.get("xp") or 0) - req.xpCost
    if "xpHistory" not in user:
        user["xpHistory"] = []
    user["xpHistory"].append({
        "amount": -req.xpCost,
        "reason": f"Redeemed: {req.rewardName}",
        "date": datetime.utcnow().isoformat(),
    })
    put_item("users", user)
    safe = {k: v for k, v in user.items() if k != "password"}
    safe["levelInfo"] = calculate_level(user.get("xp", 0))
    return safe
