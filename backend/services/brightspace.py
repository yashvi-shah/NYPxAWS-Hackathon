"""
Brightspace LMS integration service.
Retrieves course/assignment/deadline information from the institutional LMS.
Credentials are never exposed to the frontend.
"""
from config import get_settings

settings = get_settings()


async def get_courses(user_token: str) -> list[dict]:
    """Retrieve courses for a student from Brightspace."""
    if not settings.brightspace_base_url:
        return []  # Not configured
    # TODO: Implement OAuth2 flow and API calls to Brightspace
    # GET {base_url}/d2l/api/lp/1.0/enrollments/myenrollments/
    return []


async def get_assignments_for_course(user_token: str, course_id: str) -> list[dict]:
    """Retrieve assignments/deadlines for a specific course."""
    if not settings.brightspace_base_url:
        return []
    # TODO: Implement
    # GET {base_url}/d2l/api/le/1.0/{course_id}/dropbox/folders/
    return []


async def sync_deadlines(user_id: str, user_token: str) -> dict:
    """Pull all deadlines from Brightspace and sync into our system."""
    if not settings.brightspace_base_url:
        return {"synced": 0, "message": "Brightspace not configured"}
    # TODO: Implement full sync logic
    return {"synced": 0, "message": "Not yet implemented"}
