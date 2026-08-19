"""
File uploads — handles assignment attachments via S3.
Stores metadata in DynamoDB, binary in S3.
Falls back to local filesystem in dev mode.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from datetime import datetime
from typing import Optional
import os
import base64
from services.dynamodb import get_all, get_by_id, put_item, delete_item, generate_id
from config import get_settings

settings = get_settings()
router = APIRouter(prefix="/api/uploads", tags=["uploads"])

# Local upload dir for dev mode
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_TYPES = {
    "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp",
    "application/pdf", "text/plain", "text/markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/file")
async def upload_file(
    file: UploadFile = File(...),
    userId: str = Form(""),
    assignmentId: str = Form(""),
):
    """Upload a file. In dev mode stores locally; in prod uses S3."""
    if not userId:
        raise HTTPException(status_code=400, detail={"error": "userId required"})

    if file.content_type and file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail={"error": f"File type {file.content_type} not supported"})

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail={"error": "File too large (max 10MB)"})

    file_id = generate_id()
    ext = os.path.splitext(file.filename or "")[1] or ""
    stored_name = f"{file_id}{ext}"

    if settings.dev_mode:
        # Store locally in dev
        file_path = os.path.join(UPLOAD_DIR, stored_name)
        with open(file_path, "wb") as f:
            f.write(content)
        storage_key = f"local://{stored_name}"
    else:
        # S3 upload
        import boto3
        s3 = boto3.client("s3", region_name=settings.aws_region)
        bucket = f"{settings.dynamodb_table_prefix}uploads"
        s3_key = f"attachments/{userId}/{stored_name}"
        s3.put_object(Bucket=bucket, Key=s3_key, Body=content, ContentType=file.content_type or "application/octet-stream")
        storage_key = f"s3://{bucket}/{s3_key}"

    # Store metadata in DynamoDB
    metadata = {
        "id": file_id,
        "userId": userId,
        "assignmentId": assignmentId,
        "fileName": file.filename,
        "contentType": file.content_type or "application/octet-stream",
        "size": len(content),
        "storageKey": storage_key,
        "createdAt": datetime.utcnow().isoformat(),
    }
    put_item("attachments", metadata)
    return metadata


@router.get("/files")
async def list_files(userId: str = "", assignmentId: str = ""):
    """List uploaded files, filtered by user or assignment."""
    files = get_all("attachments")
    if userId:
        files = [f for f in files if f.get("userId") == userId]
    if assignmentId:
        files = [f for f in files if f.get("assignmentId") == assignmentId]
    return files


@router.delete("/files/{file_id}")
async def delete_file(file_id: str):
    """Delete a file and its metadata."""
    meta = get_by_id("attachments", file_id)
    if meta:
        # Delete actual file
        storage_key = meta.get("storageKey", "")
        if storage_key.startswith("local://"):
            local_name = storage_key.replace("local://", "")
            path = os.path.join(UPLOAD_DIR, local_name)
            if os.path.exists(path):
                os.remove(path)
        elif storage_key.startswith("s3://"):
            try:
                import boto3
                s3 = boto3.client("s3", region_name=settings.aws_region)
                parts = storage_key.replace("s3://", "").split("/", 1)
                s3.delete_object(Bucket=parts[0], Key=parts[1])
            except Exception:
                pass
    delete_item("attachments", file_id)
    return {"success": True}


@router.get("/files/{file_id}/content")
async def get_file_content(file_id: str):
    """Get file content as base64 (for AI processing). Text files returned as text."""
    meta = get_by_id("attachments", file_id)
    if not meta:
        raise HTTPException(status_code=404, detail={"error": "File not found"})

    storage_key = meta.get("storageKey", "")
    content = b""

    if storage_key.startswith("local://"):
        local_name = storage_key.replace("local://", "")
        path = os.path.join(UPLOAD_DIR, local_name)
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail={"error": "File missing from storage"})
        with open(path, "rb") as f:
            content = f.read()
    elif storage_key.startswith("s3://"):
        import boto3
        s3 = boto3.client("s3", region_name=settings.aws_region)
        parts = storage_key.replace("s3://", "").split("/", 1)
        response = s3.get_object(Bucket=parts[0], Key=parts[1])
        content = response["Body"].read()

    content_type = meta.get("contentType", "")
    if content_type.startswith("text/"):
        return {"type": "text", "content": content.decode("utf-8", errors="replace"), "meta": meta}
    else:
        return {"type": "binary", "content": base64.b64encode(content).decode(), "meta": meta}
