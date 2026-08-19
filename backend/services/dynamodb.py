"""
DynamoDB service layer.
Abstracts all database access so routers never touch boto3 directly.

Production mode (DEV_MODE=false):
  - Uses real DynamoDB tables in us-east-1
  - Relies on EC2 instance credential chain (no hardcoded keys)
  - Tables: gravity_users, gravity_assignments, gravity_study_plans,
            gravity_help_requests, gravity_discussions, gravity_calendar_events,
            gravity_flashcards, gravity_attachments
  - Errors are logged and raised — NO silent fallback to in-memory

Dev mode (DEV_MODE=true):
  - Uses in-memory dict storage
  - Seeded with demo data on startup
"""
import boto3
from boto3.dynamodb.conditions import Key
import time
import logging
from typing import Optional
from datetime import datetime, date, timedelta
from decimal import Decimal
from config import get_settings

settings = get_settings()
logger = logging.getLogger("gravity.dynamodb")

# ---------------------------------------------------------------------------
# DynamoDB client (lazy init)
# ---------------------------------------------------------------------------

_dynamodb = None


def get_dynamodb():
    """Get the DynamoDB resource. Uses default credential chain (EC2 role, CLI, env vars)."""
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=settings.aws_region)
    return _dynamodb


def table_name(entity: str) -> str:
    """
    Convert entity name to DynamoDB table name.
    e.g. 'users' -> 'gravity_users'
         'calendar_events' -> 'gravity_calendar_events'
    """
    return f"{settings.dynamodb_table_prefix}{entity}"


# ---------------------------------------------------------------------------
# In-memory storage for DEV MODE ONLY
# ---------------------------------------------------------------------------

_mem_store: dict[str, list[dict]] = {}


def _mem_get_all(entity: str) -> list[dict]:
    return list(_mem_store.setdefault(entity, []))


def _mem_get_by_id(entity: str, item_id: str) -> Optional[dict]:
    for item in _mem_store.setdefault(entity, []):
        if item.get("id") == item_id:
            return item
    return None


def _mem_put(entity: str, item: dict) -> dict:
    items = _mem_store.setdefault(entity, [])
    existing_idx = next((i for i, x in enumerate(items) if x.get("id") == item.get("id")), -1)
    if existing_idx >= 0:
        items[existing_idx] = item
    else:
        items.append(item)
    return item


def _mem_delete(entity: str, item_id: str) -> bool:
    items = _mem_store.setdefault(entity, [])
    before = len(items)
    _mem_store[entity] = [x for x in items if x.get("id") != item_id]
    return len(_mem_store[entity]) < before


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_id() -> str:
    """Generate a unique ID."""
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
    """Get all items from a table/entity. Handles DynamoDB pagination."""
    if settings.dev_mode:
        return _mem_get_all(entity)

    tbl_name = table_name(entity)
    try:
        tbl = get_dynamodb().Table(tbl_name)
        items = []
        response = tbl.scan()
        items.extend(response.get("Items", []))
        while "LastEvaluatedKey" in response:
            response = tbl.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
            items.extend(response.get("Items", []))
        # Convert Decimal back to int/float for JSON serialization
        return [_convert_decimals(item) for item in items]
    except Exception as e:
        logger.error(f"[DynamoDB] SCAN failed on {tbl_name}: {e}")
        raise


def get_by_id(entity: str, item_id: str) -> Optional[dict]:
    """Get a single item by primary key (id)."""
    if settings.dev_mode:
        return _mem_get_by_id(entity, item_id)

    tbl_name = table_name(entity)
    try:
        tbl = get_dynamodb().Table(tbl_name)
        response = tbl.get_item(Key={"id": item_id})
        item = response.get("Item")
        return _convert_decimals(item) if item else None
    except Exception as e:
        logger.error(f"[DynamoDB] GET_ITEM failed on {tbl_name}/{item_id}: {e}")
        raise


def put_item(entity: str, item: dict) -> dict:
    """Create or update an item (full replace)."""
    if settings.dev_mode:
        return _mem_put(entity, item)

    tbl_name = table_name(entity)
    try:
        tbl = get_dynamodb().Table(tbl_name)
        cleaned = _clean_for_dynamo(item)
        tbl.put_item(Item=cleaned)
        return item
    except Exception as e:
        logger.error(f"[DynamoDB] PUT_ITEM failed on {tbl_name}: {e}")
        raise


def delete_item(entity: str, item_id: str) -> bool:
    """Delete an item by primary key."""
    if settings.dev_mode:
        return _mem_delete(entity, item_id)

    tbl_name = table_name(entity)
    try:
        tbl = get_dynamodb().Table(tbl_name)
        tbl.delete_item(Key={"id": item_id})
        return True
    except Exception as e:
        logger.error(f"[DynamoDB] DELETE_ITEM failed on {tbl_name}/{item_id}: {e}")
        raise


def query_by_user(entity: str, user_id: str) -> list[dict]:
    """
    Get items filtered by userId.
    Uses the userId-index GSI for tables that have it:
      - gravity_assignments
      - gravity_study_plans
      - gravity_help_requests
      - gravity_discussions
    For tables without a GSI, falls back to scan with filter.
    """
    if settings.dev_mode:
        return [x for x in _mem_get_all(entity) if x.get("userId") == user_id]

    tbl_name = table_name(entity)

    # These tables have the userId-index GSI
    tables_with_gsi = {"assignments", "study_plans", "help_requests", "discussions"}

    try:
        tbl = get_dynamodb().Table(tbl_name)

        if entity in tables_with_gsi:
            # Use GSI for efficient query
            items = []
            response = tbl.query(
                IndexName="userId-index",
                KeyConditionExpression=Key("userId").eq(user_id),
            )
            items.extend(response.get("Items", []))
            while "LastEvaluatedKey" in response:
                response = tbl.query(
                    IndexName="userId-index",
                    KeyConditionExpression=Key("userId").eq(user_id),
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                )
                items.extend(response.get("Items", []))
            return [_convert_decimals(item) for item in items]
        else:
            # No GSI — use scan with filter
            items = []
            response = tbl.scan(
                FilterExpression=boto3.dynamodb.conditions.Attr("userId").eq(user_id),
            )
            items.extend(response.get("Items", []))
            while "LastEvaluatedKey" in response:
                response = tbl.scan(
                    FilterExpression=boto3.dynamodb.conditions.Attr("userId").eq(user_id),
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                )
                items.extend(response.get("Items", []))
            return [_convert_decimals(item) for item in items]
    except Exception as e:
        logger.error(f"[DynamoDB] QUERY_BY_USER failed on {tbl_name} for userId={user_id}: {e}")
        raise


def save_all(entity: str, items: list[dict]):
    """Bulk save — used for seeding in dev mode. In production uses batch_writer."""
    if settings.dev_mode:
        _mem_store[entity] = items
        return

    tbl_name = table_name(entity)
    try:
        tbl = get_dynamodb().Table(tbl_name)
        with tbl.batch_writer() as batch:
            for item in items:
                cleaned = _clean_for_dynamo(item)
                batch.put_item(Item=cleaned)
    except Exception as e:
        logger.error(f"[DynamoDB] BATCH_WRITE failed on {tbl_name}: {e}")
        raise


# ---------------------------------------------------------------------------
# DynamoDB data cleaning
# ---------------------------------------------------------------------------

def _clean_for_dynamo(item: dict) -> dict:
    """
    Prepare a Python dict for DynamoDB:
    - Remove None values (DynamoDB does not store None)
    - Convert float → Decimal (DynamoDB requirement)
    - Convert int → int (ensure numeric types are correct)
    - Recursively process nested dicts and lists
    """
    cleaned = {}
    for k, v in item.items():
        if v is None:
            continue
        elif isinstance(v, float):
            cleaned[k] = Decimal(str(v))
        elif isinstance(v, bool):
            cleaned[k] = v
        elif isinstance(v, int):
            cleaned[k] = v
        elif isinstance(v, dict):
            cleaned[k] = _clean_for_dynamo(v)
        elif isinstance(v, list):
            cleaned[k] = _clean_list_for_dynamo(v)
        else:
            cleaned[k] = v
    return cleaned


def _clean_list_for_dynamo(lst: list) -> list:
    """Clean a list for DynamoDB storage."""
    result = []
    for item in lst:
        if item is None:
            continue
        elif isinstance(item, dict):
            result.append(_clean_for_dynamo(item))
        elif isinstance(item, float):
            result.append(Decimal(str(item)))
        elif isinstance(item, list):
            result.append(_clean_list_for_dynamo(item))
        else:
            result.append(item)
    return result


def _convert_decimals(item) -> dict:
    """
    Convert DynamoDB Decimal values back to int/float for JSON serialization.
    DynamoDB returns numbers as Decimal objects which are not JSON-serializable.
    """
    if item is None:
        return None
    if isinstance(item, dict):
        return {k: _convert_decimals(v) for k, v in item.items()}
    elif isinstance(item, list):
        return [_convert_decimals(i) for i in item]
    elif isinstance(item, Decimal):
        # Convert to int if it's a whole number, else float
        if item % 1 == 0:
            return int(item)
        else:
            return float(item)
    return item


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

    user["xp"] = int(user.get("xp") or 0) + amount
    if "xpHistory" not in user or not isinstance(user.get("xpHistory"), list):
        user["xpHistory"] = []
    user["xpHistory"].append({
        "amount": amount,
        "reason": reason,
        "date": datetime.utcnow().isoformat(),
    })

    # Update streak
    today_str = date.today().isoformat()
    if user.get("lastActiveDate") != today_str:
        yesterday_str = (date.today() - timedelta(days=1)).isoformat()
        if user.get("lastActiveDate") == yesterday_str:
            user["streak"] = int(user.get("streak") or 0) + 1
        else:
            user["streak"] = 1
        user["lastActiveDate"] = today_str

    put_item("users", user)
    return user
