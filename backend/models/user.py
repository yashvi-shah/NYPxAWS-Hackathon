from pydantic import BaseModel, Field
from typing import Optional
from datetime import date


class XpEntry(BaseModel):
    amount: int
    reason: str
    date: str


class LevelInfo(BaseModel):
    level: int
    currentXp: int
    xpForNextLevel: int
    totalXp: int


class UserBase(BaseModel):
    name: str
    email: str
    course: str = "Engineering"
    year: int = 1


class UserCreate(UserBase):
    password: str
    avatar: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    course: str
    year: int
    xp: int = 0
    streak: int = 0
    lastActiveDate: str = ""
    avatar: str = ""
    badges: list[str] = []
    xpHistory: list[XpEntry] = []
    levelInfo: Optional[LevelInfo] = None
    createdAt: str = ""


class RedeemRequest(BaseModel):
    userId: str
    xpCost: int
    rewardName: str = "reward"
