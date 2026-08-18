"""
DynamoDB service layer.
Abstracts all database access so routers never touch boto3 directly.
Falls back to in-memory storage in dev mode when DynamoDB is unavailable.
"""
import boto3
import time
import math
from typing import Optional
from datetime import datetime, date
from config import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# DynamoDB client (lazy init)
# ---------------------------------------------------------------------------

_dynamodb = None


def get_dynamodb():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=settings.aws_region)
    return _dynamodb


def table_name(entity: str) -> str:
    return f"{settings.dynamodb_table_prefix}{entity}"


# ---------------------------------------------------------------------------
# In-memory fallback for local dev without DynamoDB
# ---------------------------------------------------------------------------

_mem_store: dict[str, list[dict]] = {}


def _mem_get_all(entity: str) -> list[dict]:
    return _mem_store.setdefault(entity, [])


def _mem_get_by_id(entity: str, item_id: str) -> Optional[dict]:
    for item in _mem_get_all(entity):
        if item.get("id") == item_id:
            return item
    return None


def _mem_put(entity: str, item: dict) -> dict:
    items = _mem_get_all(entity)
    existing_idx = next((i for i, x in enumerate(items) if x.get("id") == item.get("id")), -1)
    if existing_idx >= 0:
        items[existing_idx] = item
    else:
        items.append(item)
    return item


def _mem_delete(entity: str, item_id: str) -> bool:
    items = _mem_get_all(entity)
    before = len(items)
    _mem_store[entity] = [x for x in items if x.get("id") != item_id]
    return len(_mem_store[entity]) < before


# ---------------------------------------------------------------------------
# Public API — tries DynamoDB first, falls back to memory in dev mode
# ---------------------------------------------------------------------------

def generate_id() -> str:
    """Generate a unique ID similar to the Node.js server."""
    t = int(time.time() * 1000)
    return f"{base36(t)}{base36(int(time.time() * 10000) % 100000)}"


def base36(n: int) -> str:
    chars = "0123456789abcdefghijklmnopqrstuvwxyz"
    if n == 0:
        return "0"
    result = ""
    while n > 0:
        result = chars[n % 36] + result
        n //= 36
    return result


def get_all(entity: str) -> list[dict]:
    """Get all items from a table/entity."""
    if settings.dev_mode:
        return _mem_get_all(entity)
    try:
        tbl = get_dynamodb().Table(table_name(entity))
        response = tbl.scan()
        return response.get("Items", [])
    except Exception:
        return _mem_get_all(entity)


def get_by_id(entity: str, item_id: str) -> Optional[dict]:
    """Get a single item by ID."""
    if settings.dev_mode:
        return _mem_get_by_id(entity, item_id)
    try:
        tbl = get_dynamodb().Table(table_name(entity))
        response = tbl.get_item(Key={"id": item_id})
        return response.get("Item")
    except Exception:
        return _mem_get_by_id(entity, item_id)


def put_item(entity: str, item: dict) -> dict:
    """Create or update an item."""
    if settings.dev_mode:
        return _mem_put(entity, item)
    try:
        tbl = get_dynamodb().Table(table_name(entity))
        tbl.put_item(Item=item)
        return item
    except Exception:
        return _mem_put(entity, item)


def delete_item(entity: str, item_id: str) -> bool:
    """Delete an item by ID."""
    if settings.dev_mode:
        return _mem_delete(entity, item_id)
    try:
        tbl = get_dynamodb().Table(table_name(entity))
        tbl.delete_item(Key={"id": item_id})
        return True
    except Exception:
        return _mem_delete(entity, item_id)


def query_by_user(entity: str, user_id: str) -> list[dict]:
    """Get items filtered by userId. Uses GSI in production, filter in dev."""
    if settings.dev_mode:
        return [x for x in _mem_get_all(entity) if x.get("userId") == user_id]
    try:
        tbl = get_dynamodb().Table(table_name(entity))
        response = tbl.query(
            IndexName="userId-index",
            KeyConditionExpression=boto3.dynamodb.conditions.Key("userId").eq(user_id),
        )
        return response.get("Items", [])
    except Exception:
        return [x for x in _mem_get_all(entity) if x.get("userId") == user_id]


def save_all(entity: str, items: list[dict]):
    """Bulk save — used for seeding in dev mode."""
    if settings.dev_mode:
        _mem_store[entity] = items
    else:
        tbl = get_dynamodb().Table(table_name(entity))
        with tbl.batch_writer() as batch:
            for item in items:
                batch.put_item(Item=item)


# ---------------------------------------------------------------------------
# XP and Level helpers
# ---------------------------------------------------------------------------

def calculate_level(xp: int = 0) -> dict:
    level = 1
    xp_needed = 100
    total_xp_needed = 0
    while total_xp_needed + xp_needed <= xp:
        total_xp_needed += xp_needed
        level += 1
        xp_needed = int(100 * (1.5 ** (level - 1)))
    return {
        "level": level,
        "currentXp": xp - total_xp_needed,
        "xpForNextLevel": xp_needed,
        "totalXp": xp,
    }


def award_xp(user_id: str, amount: int, reason: str) -> Optional[dict]:
    """Award XP to a user, update streak, return updated user."""
    user = get_by_id("users", user_id)
    if not user:
        return None

    user["xp"] = (user.get("xp") or 0) + amount
    if "xpHistory" not in user:
        user["xpHistory"] = []
    user["xpHistory"].append({
        "amount": amount,
        "reason": reason,
        "date": datetime.utcnow().isoformat(),
    })

    # Update streak
    today_str = date.today().isoformat()
    if user.get("lastActiveDate") != today_str:
        from datetime import timedelta
        yesterday_str = (date.today() - timedelta(days=1)).isoformat()
        if user.get("lastActiveDate") == yesterday_str:
            user["streak"] = (user.get("streak") or 0) + 1
        else:
            user["streak"] = 1
        user["lastActiveDate"] = today_str

    put_item("users", user)
    return user
