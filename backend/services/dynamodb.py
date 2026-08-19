"""
Storage layer - local JSON files. No AWS needed at runtime.
"""
import time, logging, json, os
from typing import Optional
from datetime import datetime, date, timedelta

logger = logging.getLogger("gravity.storage")
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
os.makedirs(DATA_DIR, exist_ok=True)
_cache = {}

def _path(entity):
    return os.path.join(DATA_DIR, f"{entity}.json")

def _load(entity):
    if entity not in _cache:
        p = _path(entity)
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    _cache[entity] = json.load(f)
            except:
                _cache[entity] = []
        else:
            _cache[entity] = []
    return _cache[entity]

def _save(entity):
    try:
        with open(_path(entity), "w", encoding="utf-8") as f:
            json.dump(_cache.get(entity, []), f, indent=2, default=str)
    except:
        pass

def generate_id():
    t = int(time.time() * 1000)
    return f"{_b36(t)}{_b36(int(time.time() * 10000) % 100000)}"

def _b36(n):
    c = "0123456789abcdefghijklmnopqrstuvwxyz"
    if n == 0:
        return "0"
    r = ""
    while n > 0:
        r = c[n % 36] + r
        n //= 36
    return r

def get_all(entity):
    return list(_load(entity))

def get_by_id(entity, item_id):
    return next((i for i in _load(entity) if i.get("id") == item_id), None)

def put_item(entity, item):
    items = _load(entity)
    idx = next((i for i, x in enumerate(items) if x.get("id") == item.get("id")), -1)
    if idx >= 0:
        items[idx] = item
    else:
        items.append(item)
    _save(entity)
    return item

def delete_item(entity, item_id):
    items = _load(entity)
    before = len(items)
    _cache[entity] = [x for x in items if x.get("id") != item_id]
    _save(entity)
    return len(_cache[entity]) < before

def query_by_user(entity, user_id):
    return [x for x in _load(entity) if x.get("userId") == user_id]

def save_all(entity, items):
    _cache[entity] = items
    _save(entity)

def calculate_level(xp=0):
    level = 1
    needed = 100
    total = 0
    while total + needed <= xp:
        total += needed
        level += 1
        needed = int(100 * (1.5 ** (level - 1)))
    return {"level": level, "currentXp": xp - total, "xpForNextLevel": needed, "totalXp": xp}

def award_xp(user_id, amount, reason):
    user = get_by_id("users", user_id)
    if not user:
        return None
    user["xp"] = int(user.get("xp") or 0) + amount
    if not isinstance(user.get("xpHistory"), list):
        user["xpHistory"] = []
    user["xpHistory"].append({"amount": amount, "reason": reason, "date": datetime.utcnow().isoformat()})
    today_str = date.today().isoformat()
    if user.get("lastActiveDate") != today_str:
        y = (date.today() - timedelta(days=1)).isoformat()
        user["streak"] = (int(user.get("streak") or 0) + 1) if user.get("lastActiveDate") == y else 1
        user["lastActiveDate"] = today_str
    put_item("users", user)
    return user

def table_name(entity):
    return f"gravity_{entity}"
