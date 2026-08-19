"""
Seeds the in-memory database with demo data for local development.
Run this at startup when DEV_MODE=true so the app has data to work with.
"""
from datetime import datetime, timedelta
from services.dynamodb import save_all

DAY = timedelta(days=1)
NOW = datetime.utcnow()
TODAY = NOW.date().isoformat()


def seed():
    """Populate in-memory store with demo data."""

    users = [
        {
            "id": "user1", "name": "Alex Chen", "email": "alex@studysphere.com",
            "password": "demo123", "course": "Electrical Engineering", "year": 2,
            "xp": 1290, "streak": 7, "lastActiveDate": TODAY, "avatar": "",
            "badges": ["first-assignment", "streak-3", "streak-7", "early-bird"],
            "xpHistory": [
                {"amount": 50, "reason": "Completed: Circuit Analysis Report", "date": (NOW - 6 * DAY).isoformat()},
                {"amount": 10, "reason": "Added new assignment", "date": (NOW - 5 * DAY).isoformat()},
                {"amount": 15, "reason": "Generated study plan", "date": (NOW - 4 * DAY).isoformat()},
                {"amount": 15, "reason": "Generated study plan", "date": (NOW - 3 * DAY).isoformat()},
                {"amount": 5, "reason": "Started a discussion", "date": (NOW - 2 * DAY).isoformat()},
                {"amount": 10, "reason": "Progress on: IoT Prototype", "date": (NOW - 1 * DAY).isoformat()},
            ],
            "createdAt": (NOW - 30 * DAY).isoformat(),
        },
        {
            "id": "user2", "name": "Sarah Lee", "email": "sarah@studysphere.com",
            "password": "demo123", "course": "Information Technology", "year": 2,
            "xp": 980, "streak": 4, "lastActiveDate": TODAY, "avatar": "",
            "badges": ["first-assignment", "streak-3", "helper"],
            "xpHistory": [], "createdAt": (NOW - 25 * DAY).isoformat(),
        },
        {
            "id": "user3", "name": "Marcus Tan", "email": "marcus@studysphere.com",
            "password": "demo123", "course": "Mechanical Engineering", "year": 3,
            "xp": 2100, "streak": 12, "lastActiveDate": TODAY, "avatar": "",
            "badges": ["first-assignment", "streak-3", "streak-7", "early-bird", "helper", "planner", "level-5"],
            "xpHistory": [], "createdAt": (NOW - 60 * DAY).isoformat(),
        },
        {
            "id": "user4", "name": "Priya Sharma", "email": "priya@studysphere.com",
            "password": "demo123", "course": "Business Analytics", "year": 1,
            "xp": 450, "streak": 2, "lastActiveDate": TODAY, "avatar": "",
            "badges": ["first-assignment"],
            "xpHistory": [], "createdAt": (NOW - 10 * DAY).isoformat(),
        },
        {
            "id": "user5", "name": "Jake Wong", "email": "jake@studysphere.com",
            "password": "demo123", "course": "Game Design", "year": 2,
            "xp": 1680, "streak": 5, "lastActiveDate": TODAY, "avatar": "",
            "badges": ["first-assignment", "streak-3", "streak-7", "social", "level-5"],
            "xpHistory": [], "createdAt": (NOW - 45 * DAY).isoformat(),
        },
    ]

    assignments = [
        {"id": "asgn1", "title": "IoT Smart Home Prototype", "module": "EE4301 - IoT Systems", "type": "Project", "deadline": (NOW + 2 * DAY).date().isoformat(), "weightage": 40, "confidence": 35, "progress": 45, "status": "pending", "description": "Design and build a smart home IoT prototype.", "userId": "user1", "createdAt": (NOW - 14 * DAY).isoformat()},
        {"id": "asgn2", "title": "Digital Signal Processing Lab Report", "module": "EE3205 - DSP", "type": "Lab Report", "deadline": (NOW + 5 * DAY).date().isoformat(), "weightage": 15, "confidence": 60, "progress": 20, "status": "pending", "description": "Lab report on FFT analysis.", "userId": "user1", "createdAt": (NOW - 7 * DAY).isoformat()},
        {"id": "asgn3", "title": "Machine Learning Classification Model", "module": "IT3402 - AI & ML", "type": "Programming", "deadline": (NOW + 8 * DAY).date().isoformat(), "weightage": 30, "confidence": 45, "progress": 10, "status": "pending", "description": "Build a classification model.", "userId": "user1", "createdAt": (NOW - 5 * DAY).isoformat()},
        {"id": "asgn4", "title": "Technical Writing Essay", "module": "GE2101 - Communication", "type": "Essay", "deadline": (NOW + 12 * DAY).date().isoformat(), "weightage": 20, "confidence": 75, "progress": 0, "status": "pending", "description": "2000-word essay on AI in engineering.", "userId": "user1", "createdAt": (NOW - 3 * DAY).isoformat()},
        {"id": "asgn5", "title": "Group Presentation: Renewable Energy", "module": "EE3101 - Power Systems", "type": "Presentation", "deadline": (NOW + 18 * DAY).date().isoformat(), "weightage": 25, "confidence": 55, "progress": 30, "status": "pending", "description": "15-minute group presentation.", "userId": "user1", "createdAt": (NOW - 10 * DAY).isoformat()},
        {"id": "asgn6", "title": "Database Normalization Exercise", "module": "IT2205 - Databases", "type": "Programming", "deadline": (NOW + 1 * DAY).date().isoformat(), "weightage": 10, "confidence": 80, "progress": 90, "status": "pending", "description": "Normalize schema to 3NF.", "userId": "user1", "createdAt": (NOW - 5 * DAY).isoformat()},
        {"id": "asgn7", "title": "Web Application Project", "module": "IT3305 - Web Dev", "type": "Project", "deadline": (NOW + 25 * DAY).date().isoformat(), "weightage": 45, "confidence": 50, "progress": 15, "status": "pending", "description": "Full-stack web app.", "userId": "user2", "createdAt": (NOW - 20 * DAY).isoformat()},
    ]

    help_requests = [
        {"id": "help1", "title": "Need help with Arduino sensor calibration", "description": "My DHT22 temperature sensor is giving inaccurate readings.", "category": "Practical", "module": "EE4301 - IoT Systems", "urgency": "high", "userId": "user1", "userName": "Alex Chen", "status": "open", "responses": [{"userId": "user3", "userName": "Marcus Tan", "message": "Try adding a 100nF capacitor across the power pins.", "date": (NOW - 1 * DAY).isoformat()}], "createdAt": (NOW - 2 * DAY).isoformat()},
        {"id": "help2", "title": "SolidWorks assembly constraints help", "description": "Struggling with mate constraints in my gearbox assembly.", "category": "Practical", "module": "ME2401 - CAD/CAM", "urgency": "medium", "userId": "user3", "userName": "Marcus Tan", "status": "open", "responses": [], "createdAt": (NOW - 1 * DAY).isoformat()},
        {"id": "help3", "title": "Python scikit-learn: Feature selection for classification", "description": "Dataset has 50+ features. Best approach for feature selection?", "category": "Academic", "module": "IT3402 - AI & ML", "urgency": "medium", "userId": "user1", "userName": "Alex Chen", "status": "open", "responses": [{"userId": "user2", "userName": "Sarah Lee", "message": "Start with correlation matrix to remove highly correlated features.", "date": (NOW - DAY * 0.5).isoformat()}], "createdAt": (NOW - 1 * DAY).isoformat()},
        {"id": "help4", "title": "Need 3D printer access for prototype", "description": "Looking for someone who has access to a 3D printer.", "category": "Practical", "module": "", "urgency": "high", "userId": "user1", "userName": "Alex Chen", "status": "open", "responses": [], "createdAt": NOW.isoformat()},
    ]

    discussions = [
        {"id": "disc1", "title": "Tips for DSP lab report writing", "content": "Just finished my DSP lab report. Here are some tips...", "module": "EE3205 - DSP", "tags": ["tips", "lab-report", "dsp"], "userId": "user3", "userName": "Marcus Tan", "replies": [{"userId": "user1", "userName": "Alex Chen", "content": "Thanks! Do we need the theoretical derivation?", "date": (NOW - 2 * DAY).isoformat()}, {"userId": "user3", "userName": "Marcus Tan", "content": "Just explain the concept and reference the textbook.", "date": (NOW - 1.5 * DAY).isoformat()}], "upvotes": 12, "createdAt": (NOW - 3 * DAY).isoformat()},
        {"id": "disc2", "title": "Best practices for IoT security", "content": "Sharing some security tips for IoT projects...", "module": "EE4301 - IoT Systems", "tags": ["iot", "security"], "userId": "user1", "userName": "Alex Chen", "replies": [], "upvotes": 5, "createdAt": (NOW - 1 * DAY).isoformat()},
        {"id": "disc3", "title": "ML model evaluation metrics comparison", "content": "When to use accuracy vs F1-score vs ROC-AUC...", "module": "IT3402 - AI & ML", "tags": ["ml", "evaluation"], "userId": "user2", "userName": "Sarah Lee", "replies": [{"userId": "user1", "userName": "Alex Chen", "content": "Great comparison. For imbalanced datasets F1 is much better.", "date": (NOW - 0.5 * DAY).isoformat()}], "upvotes": 8, "createdAt": (NOW - 2 * DAY).isoformat()},
    ]

    # Sample calendar events
    calendar_events = [
        {"id": "evt1", "title": "IoT Prototype Work", "date": (NOW + 1 * DAY).date().isoformat(), "startTime": "19:00", "endTime": "21:00", "duration": 120, "category": "study-session", "assignmentId": "asgn1", "module": "EE4301 - IoT Systems", "description": "Work on sensor integration", "userId": "user1", "createdAt": NOW.isoformat()},
        {"id": "evt2", "title": "DSP Lab Report Writing", "date": (NOW + 2 * DAY).date().isoformat(), "startTime": "14:00", "endTime": "16:00", "duration": 120, "category": "study-session", "assignmentId": "asgn2", "module": "EE3205 - DSP", "description": "Write methodology section", "userId": "user1", "createdAt": NOW.isoformat()},
        {"id": "evt3", "title": "ML Model Training", "date": (NOW + 3 * DAY).date().isoformat(), "startTime": "19:00", "endTime": "20:30", "duration": 90, "category": "study-session", "assignmentId": "asgn3", "module": "IT3402 - AI & ML", "description": "Train and evaluate classifier", "userId": "user1", "createdAt": NOW.isoformat()},
        {"id": "evt4", "title": "Group Meeting", "date": (NOW + 4 * DAY).date().isoformat(), "startTime": "10:00", "endTime": "11:00", "duration": 60, "category": "event", "module": "EE3101 - Power Systems", "description": "Discuss presentation slides", "userId": "user1", "createdAt": NOW.isoformat()},
        {"id": "evt5", "title": "Essay Research", "date": (NOW + 5 * DAY).date().isoformat(), "startTime": "15:00", "endTime": "17:00", "duration": 120, "category": "study-session", "assignmentId": "asgn4", "module": "GE2101 - Communication", "description": "Research AI impact sources", "userId": "user1", "createdAt": NOW.isoformat()},
    ]

    save_all("users", users)
    save_all("assignments", assignments)
    save_all("study_plans", [])
    save_all("help_requests", help_requests)
    save_all("discussions", discussions)
    save_all("calendar_events", calendar_events)
    save_all("flashcards", [])
    save_all("attachments", [])

    print(f"  Seeded: {len(users)} users, {len(assignments)} assignments, {len(help_requests)} help requests, {len(discussions)} discussions, {len(calendar_events)} calendar events")
