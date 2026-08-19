"""Seed local JSON data for demo."""
import json, os
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)
NOW = datetime.utcnow()
DAY = timedelta(days=1)
TODAY = NOW.date().isoformat()

def save(n, d):
    with open(os.path.join(DATA_DIR, f"{n}.json"), "w") as f:
        json.dump(d, f, indent=2, default=str)
    print(f"  {n}: {len(d)} items")

users = [{"id": "user1", "name": "Alex Chen", "email": "alex@studysphere.com", "password": "demo123", "course": "Electrical Engineering", "year": 2, "xp": 1290, "streak": 7, "lastActiveDate": TODAY, "avatar": "", "badges": [], "xpHistory": [], "createdAt": (NOW - 30 * DAY).isoformat()}]

assignments = [
    {"id": "asgn1", "title": "IoT Smart Home Prototype", "module": "EE4301 - IoT Systems", "type": "Project", "deadline": (NOW + 2 * DAY).date().isoformat(), "weightage": 40, "confidence": 35, "progress": 45, "status": "pending", "description": "Build IoT prototype", "userId": "user1", "createdAt": (NOW - 14 * DAY).isoformat()},
    {"id": "asgn2", "title": "DSP Lab Report", "module": "EE3205 - DSP", "type": "Lab Report", "deadline": (NOW + 5 * DAY).date().isoformat(), "weightage": 15, "confidence": 60, "progress": 20, "status": "pending", "description": "FFT analysis", "userId": "user1", "createdAt": (NOW - 7 * DAY).isoformat()},
    {"id": "asgn3", "title": "ML Classification Model", "module": "IT3402 - AI & ML", "type": "Programming", "deadline": (NOW + 8 * DAY).date().isoformat(), "weightage": 30, "confidence": 45, "progress": 10, "status": "pending", "description": "Build classifier", "userId": "user1", "createdAt": (NOW - 5 * DAY).isoformat()},
]

events = [
    {"id": "evt1", "title": "IoT Prototype Work", "date": (NOW + 1 * DAY).date().isoformat(), "startTime": "19:00", "endTime": "21:00", "duration": 120, "category": "study", "module": "EE4301 - IoT Systems", "description": "Sensor work", "userId": "user1", "createdAt": NOW.isoformat()},
    {"id": "evt2", "title": "DSP Report", "date": (NOW + 2 * DAY).date().isoformat(), "startTime": "14:00", "endTime": "16:00", "duration": 120, "category": "study", "module": "EE3205 - DSP", "description": "Write report", "userId": "user1", "createdAt": NOW.isoformat()},
]

print("Seeding...")
save("users", users)
save("assignments", assignments)
save("study_plans", [])
save("calendar_events", events)
save("flashcards", [])
save("help_requests", [])
save("discussions", [])
save("attachments", [])
print("Done!")
