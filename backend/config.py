"""
Application configuration — loaded from environment variables.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # AWS
    aws_region: str = "us-east-1"
    dynamodb_table_prefix: str = "gravity_"
    s3_bucket: str = "gravity-uploads"

    # Gemini AI
    gemini_api_key: str = ""

    # Brightspace
    brightspace_base_url: str = ""
    brightspace_client_id: str = ""
    brightspace_client_secret: str = ""

    # Application
    frontend_origin: str = "http://localhost:3000"
    secret_key: str = "change-me-in-production"
    dev_mode: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
