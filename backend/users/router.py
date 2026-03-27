"""
Users Router
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..database.connection import get_db
from ..database.models import User, ScanHistory, UserBaseline
from ..auth.dependencies import get_current_user
from ..auth.jwt import hash_password, verify_password

router = APIRouter(prefix="/api/users", tags=["Users"])


# ============================================================================
# Schemas
# ============================================================================

class UpdateProfileRequest(BaseModel):
    nickname: Optional[str] = None
    age_range: Optional[str] = None
    goal: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserProfileResponse(BaseModel):
    id: str
    email: str
    nickname: Optional[str]
    age_range: Optional[str]
    goal: Optional[str]
    avatar_url: Optional[str]
    is_verified: bool

    class Config:
        from_attributes = True


# ============================================================================
# Profile
# ============================================================================

@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    return UserProfileResponse.model_validate(current_user)


@router.patch("/profile")
async def update_profile(
    request: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user profile"""

    if request.nickname is not None:
        current_user.nickname = request.nickname

    if request.age_range is not None:
        current_user.age_range = request.age_range

    if request.goal is not None:
        current_user.goal = request.goal

    db.commit()

    return {"success": True, "message": "Profile updated successfully"}


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change user password"""

    if not current_user.password_hash:
        raise HTTPException(
            status_code=400,
            detail="Cannot change password for OAuth accounts",
        )

    if not verify_password(request.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    current_user.password_hash = hash_password(request.new_password)
    db.commit()

    return {"success": True, "message": "Password changed successfully"}


# ============================================================================
# Data Management
# ============================================================================

@router.delete("/data")
async def delete_all_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete all user data (GDPR compliance)"""

    # Delete scan history
    db.query(ScanHistory).filter(ScanHistory.user_id == current_user.id).delete()

    # Delete baseline
    db.query(UserBaseline).filter(UserBaseline.user_id == current_user.id).delete()

    db.commit()

    return {"success": True, "message": "All data deleted successfully"}


@router.delete("/account")
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete user account and all associated data"""

    db.delete(current_user)
    db.commit()

    return {"success": True, "message": "Account deleted successfully"}
