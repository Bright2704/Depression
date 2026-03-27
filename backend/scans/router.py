"""
Scans Router - Save and retrieve scan history
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

from ..database.connection import get_db
from ..database.models import User, ScanHistory, UserBaseline
from ..auth.dependencies import get_current_user, get_current_user_optional

router = APIRouter(prefix="/api/scans", tags=["Scans"])


# ============================================================================
# Schemas
# ============================================================================

class SaveScanRequest(BaseModel):
    phq9_score: int
    severity: str
    confidence: float
    energy_level: Optional[int] = None
    stress_level: Optional[int] = None
    fatigue_level: Optional[int] = None
    risk_indicators: Optional[dict] = None
    facial_summary: Optional[dict] = None
    session_id: Optional[str] = None
    window_count: Optional[int] = None
    total_frames: Optional[int] = None
    scan_duration_seconds: Optional[int] = None


class ScanResponse(BaseModel):
    id: str
    phq9_score: int
    severity: str
    confidence: float
    energy_level: Optional[int]
    stress_level: Optional[int]
    fatigue_level: Optional[int]
    risk_indicators: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True


class ScanListResponse(BaseModel):
    scans: List[ScanResponse]
    total: int
    page: int
    page_size: int


class DashboardResponse(BaseModel):
    weekly_trend: List[dict]
    average_score: float
    improvement_percent: float
    streak_days: int
    last_check_in: Optional[datetime]
    total_scans: int
    alerts: List[dict]


class SaveBaselineRequest(BaseModel):
    baseline_data: dict


# ============================================================================
# Save Scan
# ============================================================================

@router.post("/", response_model=ScanResponse)
async def save_scan(
    request: SaveScanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save a scan result for the authenticated user"""

    scan = ScanHistory(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        phq9_score=request.phq9_score,
        severity=request.severity,
        confidence=request.confidence,
        energy_level=request.energy_level,
        stress_level=request.stress_level,
        fatigue_level=request.fatigue_level,
        risk_indicators=request.risk_indicators,
        facial_summary=request.facial_summary,
        session_id=request.session_id,
        window_count=request.window_count,
        total_frames=request.total_frames,
        scan_duration_seconds=request.scan_duration_seconds,
    )

    db.add(scan)
    db.commit()
    db.refresh(scan)

    return ScanResponse.model_validate(scan)


# ============================================================================
# Get Scan History
# ============================================================================

@router.get("/", response_model=ScanListResponse)
async def get_scan_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get user's scan history with pagination"""

    offset = (page - 1) * page_size

    scans = db.query(ScanHistory).filter(
        ScanHistory.user_id == current_user.id
    ).order_by(desc(ScanHistory.created_at)).offset(offset).limit(page_size).all()

    total = db.query(func.count(ScanHistory.id)).filter(
        ScanHistory.user_id == current_user.id
    ).scalar()

    return ScanListResponse(
        scans=[ScanResponse.model_validate(s) for s in scans],
        total=total,
        page=page,
        page_size=page_size,
    )


# ============================================================================
# Get Single Scan
# ============================================================================

@router.get("/{scan_id}", response_model=ScanResponse)
async def get_scan(
    scan_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific scan by ID"""

    scan = db.query(ScanHistory).filter(
        ScanHistory.id == scan_id,
        ScanHistory.user_id == current_user.id,
    ).first()

    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    return ScanResponse.model_validate(scan)


# ============================================================================
# Dashboard Data
# ============================================================================

@router.get("/dashboard/data", response_model=DashboardResponse)
async def get_dashboard_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get dashboard data for the user"""

    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)

    # Weekly trend
    weekly_scans = db.query(ScanHistory).filter(
        ScanHistory.user_id == current_user.id,
        ScanHistory.created_at >= week_ago,
    ).order_by(ScanHistory.created_at).all()

    weekly_trend = [
        {
            "date": s.created_at.strftime("%Y-%m-%d"),
            "score": s.phq9_score,
            "severity": s.severity,
        }
        for s in weekly_scans
    ]

    # Average score (last 30 days)
    month_ago = now - timedelta(days=30)
    avg_score = db.query(func.avg(ScanHistory.phq9_score)).filter(
        ScanHistory.user_id == current_user.id,
        ScanHistory.created_at >= month_ago,
    ).scalar() or 0

    # Improvement percent (compare last week to previous week)
    two_weeks_ago = now - timedelta(days=14)

    last_week_avg = db.query(func.avg(ScanHistory.phq9_score)).filter(
        ScanHistory.user_id == current_user.id,
        ScanHistory.created_at >= week_ago,
    ).scalar() or 0

    prev_week_avg = db.query(func.avg(ScanHistory.phq9_score)).filter(
        ScanHistory.user_id == current_user.id,
        ScanHistory.created_at >= two_weeks_ago,
        ScanHistory.created_at < week_ago,
    ).scalar() or 0

    if prev_week_avg > 0:
        improvement_percent = ((prev_week_avg - last_week_avg) / prev_week_avg) * 100
    else:
        improvement_percent = 0

    # Streak days
    streak_days = 0
    current_date = now.date()

    while True:
        has_scan = db.query(ScanHistory).filter(
            ScanHistory.user_id == current_user.id,
            func.date(ScanHistory.created_at) == current_date,
        ).first()

        if has_scan:
            streak_days += 1
            current_date -= timedelta(days=1)
        else:
            break

    # Last check-in
    last_scan = db.query(ScanHistory).filter(
        ScanHistory.user_id == current_user.id
    ).order_by(desc(ScanHistory.created_at)).first()

    # Total scans
    total_scans = db.query(func.count(ScanHistory.id)).filter(
        ScanHistory.user_id == current_user.id
    ).scalar()

    # Alerts
    alerts = []

    if last_scan:
        days_since_last = (now - last_scan.created_at).days
        if days_since_last >= 3:
            alerts.append({
                "type": "info",
                "message": f"คุณยังไม่ได้เช็กอินมา {days_since_last} วัน"
            })

        if last_scan.phq9_score >= 15:
            alerts.append({
                "type": "warning",
                "message": "คะแนนล่าสุดอยู่ในระดับที่ควรปรึกษาผู้เชี่ยวชาญ"
            })

    if streak_days >= 7:
        alerts.append({
            "type": "success",
            "message": f"ยอดเยี่ยม! คุณเช็กอินติดต่อกันมา {streak_days} วันแล้ว"
        })

    return DashboardResponse(
        weekly_trend=weekly_trend,
        average_score=round(float(avg_score), 1),
        improvement_percent=round(float(improvement_percent), 1),
        streak_days=streak_days,
        last_check_in=last_scan.created_at if last_scan else None,
        total_scans=total_scans,
        alerts=alerts,
    )


# ============================================================================
# Baseline
# ============================================================================

@router.get("/baseline/data")
async def get_baseline(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get user's baseline data"""

    baseline = db.query(UserBaseline).filter(
        UserBaseline.user_id == current_user.id
    ).first()

    if not baseline:
        return {"success": True, "data": None}

    return {
        "success": True,
        "data": baseline.baseline_data,
        "updated_at": baseline.updated_at,
    }


@router.post("/baseline/data")
async def save_baseline(
    request: SaveBaselineRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save user's baseline data"""

    baseline = db.query(UserBaseline).filter(
        UserBaseline.user_id == current_user.id
    ).first()

    if baseline:
        baseline.baseline_data = request.baseline_data
    else:
        baseline = UserBaseline(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            baseline_data=request.baseline_data,
        )
        db.add(baseline)

    db.commit()

    return {"success": True, "message": "Baseline saved successfully"}
