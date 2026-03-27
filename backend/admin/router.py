"""
Admin Router
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel
import uuid

from ..database.connection import get_db
from ..database.models import User, ScanHistory, AdminActivityLog
from ..auth.dependencies import require_admin, get_client_ip, get_user_agent

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ============================================================================
# Schemas
# ============================================================================

class UserListItem(BaseModel):
    id: str
    email: str
    nickname: Optional[str]
    role: str
    is_active: bool
    is_verified: bool
    oauth_provider: Optional[str]
    scan_count: int
    last_scan_at: Optional[datetime]
    created_at: datetime
    last_login_at: Optional[datetime]


class UserListResponse(BaseModel):
    users: List[UserListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class ScanHistoryItem(BaseModel):
    id: str
    phq9_score: int
    severity: str
    confidence: float
    energy_level: Optional[int]
    stress_level: Optional[int]
    fatigue_level: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class UserDetailResponse(BaseModel):
    id: str
    email: str
    nickname: Optional[str]
    role: str
    age_range: Optional[str]
    goal: Optional[str]
    avatar_url: Optional[str]
    is_active: bool
    is_verified: bool
    oauth_provider: Optional[str]
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime]
    scan_history: List[ScanHistoryItem]
    total_scans: int


class UpdateUserRequest(BaseModel):
    nickname: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None


class DashboardStats(BaseModel):
    total_users: int
    active_users: int
    total_scans: int
    scans_today: int
    scans_this_week: int
    average_phq9: float
    severity_distribution: dict
    daily_scans: List[dict]


# ============================================================================
# Helper Functions
# ============================================================================

def log_admin_action(
    db: Session,
    admin: User,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
):
    """Log admin activity"""
    log = AdminActivityLog(
        id=str(uuid.uuid4()),
        admin_id=admin.id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(log)


# ============================================================================
# Dashboard Stats
# ============================================================================

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get admin dashboard statistics"""

    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    # User stats
    total_users = db.query(func.count(User.id)).filter(User.role == "user").scalar()
    active_users = db.query(func.count(User.id)).filter(
        User.role == "user",
        User.last_login_at >= week_start,
    ).scalar()

    # Scan stats
    total_scans = db.query(func.count(ScanHistory.id)).scalar()
    scans_today = db.query(func.count(ScanHistory.id)).filter(
        ScanHistory.created_at >= today_start,
    ).scalar()
    scans_this_week = db.query(func.count(ScanHistory.id)).filter(
        ScanHistory.created_at >= week_start,
    ).scalar()

    # Average PHQ-9
    avg_phq9 = db.query(func.avg(ScanHistory.phq9_score)).scalar() or 0

    # Severity distribution
    severity_counts = db.query(
        ScanHistory.severity,
        func.count(ScanHistory.id),
    ).group_by(ScanHistory.severity).all()

    severity_distribution = {s: c for s, c in severity_counts}

    # Daily scans for the last 7 days
    daily_scans = []
    for i in range(7):
        day_start = today_start - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        count = db.query(func.count(ScanHistory.id)).filter(
            ScanHistory.created_at >= day_start,
            ScanHistory.created_at < day_end,
        ).scalar()
        daily_scans.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "count": count,
        })

    daily_scans.reverse()

    return DashboardStats(
        total_users=total_users,
        active_users=active_users,
        total_scans=total_scans,
        scans_today=scans_today,
        scans_this_week=scans_this_week,
        average_phq9=round(float(avg_phq9), 2),
        severity_distribution=severity_distribution,
        daily_scans=daily_scans,
    )


# ============================================================================
# User Management
# ============================================================================

@router.get("/users", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all users with pagination and filters"""

    query = db.query(User)

    # Apply filters
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.email.ilike(search_term)) |
            (User.nickname.ilike(search_term))
        )

    if role:
        query = query.filter(User.role == role)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    # Get total count
    total = query.count()

    # Paginate
    offset = (page - 1) * page_size
    users = query.order_by(desc(User.created_at)).offset(offset).limit(page_size).all()

    # Build response with scan counts
    user_items = []
    for user in users:
        scan_count = db.query(func.count(ScanHistory.id)).filter(
            ScanHistory.user_id == user.id
        ).scalar()

        last_scan = db.query(ScanHistory.created_at).filter(
            ScanHistory.user_id == user.id
        ).order_by(desc(ScanHistory.created_at)).first()

        user_items.append(UserListItem(
            id=user.id,
            email=user.email,
            nickname=user.nickname,
            role=user.role,
            is_active=user.is_active,
            is_verified=user.is_verified,
            oauth_provider=user.oauth_provider,
            scan_count=scan_count,
            last_scan_at=last_scan[0] if last_scan else None,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
        ))

    total_pages = (total + page_size - 1) // page_size

    return UserListResponse(
        users=user_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/users/{user_id}", response_model=UserDetailResponse)
async def get_user_detail(
    user_id: str,
    req: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get detailed user information including scan history"""

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get scan history
    scans = db.query(ScanHistory).filter(
        ScanHistory.user_id == user_id
    ).order_by(desc(ScanHistory.created_at)).limit(50).all()

    total_scans = db.query(func.count(ScanHistory.id)).filter(
        ScanHistory.user_id == user_id
    ).scalar()

    # Log action
    log_admin_action(
        db, admin, "view_user",
        target_type="user", target_id=user_id,
        ip_address=get_client_ip(req), user_agent=get_user_agent(req),
    )
    db.commit()

    return UserDetailResponse(
        id=user.id,
        email=user.email,
        nickname=user.nickname,
        role=user.role,
        age_range=user.age_range,
        goal=user.goal,
        avatar_url=user.avatar_url,
        is_active=user.is_active,
        is_verified=user.is_verified,
        oauth_provider=user.oauth_provider,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login_at=user.last_login_at,
        scan_history=[ScanHistoryItem.model_validate(s) for s in scans],
        total_scans=total_scans,
    )


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    request: UpdateUserRequest,
    req: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update user information"""

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent modifying self role
    if user_id == admin.id and request.role and request.role != admin.role:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    changes = {}

    if request.nickname is not None:
        changes["nickname"] = {"old": user.nickname, "new": request.nickname}
        user.nickname = request.nickname

    if request.role is not None:
        if request.role not in ["user", "admin"]:
            raise HTTPException(status_code=400, detail="Invalid role")
        changes["role"] = {"old": user.role, "new": request.role}
        user.role = request.role

    if request.is_active is not None:
        changes["is_active"] = {"old": user.is_active, "new": request.is_active}
        user.is_active = request.is_active

    if request.is_verified is not None:
        changes["is_verified"] = {"old": user.is_verified, "new": request.is_verified}
        user.is_verified = request.is_verified

    # Log action
    log_admin_action(
        db, admin, "edit_user",
        target_type="user", target_id=user_id,
        details={"changes": changes},
        ip_address=get_client_ip(req), user_agent=get_user_agent(req),
    )

    db.commit()

    return {"success": True, "message": "User updated successfully"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    req: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a user and all their data"""

    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin users")

    # Log action before deletion
    log_admin_action(
        db, admin, "delete_user",
        target_type="user", target_id=user_id,
        details={"email": user.email, "nickname": user.nickname},
        ip_address=get_client_ip(req), user_agent=get_user_agent(req),
    )

    db.delete(user)
    db.commit()

    return {"success": True, "message": "User deleted successfully"}


# ============================================================================
# Activity Log
# ============================================================================

@router.get("/activity-log")
async def get_activity_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get admin activity log"""

    offset = (page - 1) * page_size

    logs = db.query(AdminActivityLog).order_by(
        desc(AdminActivityLog.created_at)
    ).offset(offset).limit(page_size).all()

    total = db.query(func.count(AdminActivityLog.id)).scalar()

    return {
        "logs": [
            {
                "id": log.id,
                "admin_id": log.admin_id,
                "action": log.action,
                "target_type": log.target_type,
                "target_id": log.target_id,
                "details": log.details,
                "ip_address": log.ip_address,
                "created_at": log.created_at,
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
