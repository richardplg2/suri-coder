import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str = Field(min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    avatar_url: str | None = None
    role: UserRole
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
