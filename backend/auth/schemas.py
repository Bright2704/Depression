"""
Auth Pydantic Schemas
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


# ============================================================================
# Request Schemas
# ============================================================================

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    nickname: Optional[str] = Field(None, max_length=100)
    age_range: Optional[str] = None
    goal: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class OAuthCallbackRequest(BaseModel):
    code: str
    redirect_uri: str


# ============================================================================
# Response Schemas
# ============================================================================

class UserResponse(BaseModel):
    id: str
    email: str
    nickname: Optional[str]
    role: str
    age_range: Optional[str]
    goal: Optional[str]
    avatar_url: Optional[str]
    is_verified: bool
    is_pro: bool = False
    subscription_plan: Optional[str] = None
    subscription_expires_at: Optional[datetime] = None
    created_at: datetime
    last_login_at: Optional[datetime]

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class AuthResponse(BaseModel):
    success: bool
    message: str
    data: Optional[TokenResponse] = None
