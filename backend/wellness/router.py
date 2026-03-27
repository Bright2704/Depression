"""
Opt-in สำหรับส่งเวกเตอร์และ PHQ-9 ขึ้นเซิร์ฟเวอร์ (ค่าเริ่มต้นเก็บใน IndexedDB ฝั่ง client)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid

from ..database.connection import get_db
from ..database.models import User, UserWellnessOptIn, WellnessVectorSample, WellnessPhq9Label
from ..auth.dependencies import get_current_user

router = APIRouter(prefix="/api/wellness", tags=["Wellness"])


class WellnessSettingsResponse(BaseModel):
    share_vectors: bool
    share_phq9: bool


class WellnessSettingsUpdate(BaseModel):
    share_vectors: bool = False
    share_phq9: bool = False


class VectorSampleRequest(BaseModel):
    vector: List[float] = Field(..., description="เวกเตอร์ฟีเจอร์เท่านั้น ไม่มีภาพ")
    dim: int
    time_epoch: Optional[str] = None
    session_id: Optional[str] = None


class Phq9LabelRequest(BaseModel):
    total_score: int = Field(..., ge=0, le=27)
    answers: Optional[List[int]] = None


def _get_or_create_opt_in(db: Session, user_id: str) -> UserWellnessOptIn:
    row = db.query(UserWellnessOptIn).filter(UserWellnessOptIn.user_id == user_id).first()
    if row:
        return row
    row = UserWellnessOptIn(user_id=user_id, share_vectors=False, share_phq9=False)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/settings", response_model=WellnessSettingsResponse)
async def get_wellness_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_or_create_opt_in(db, current_user.id)
    return WellnessSettingsResponse(share_vectors=row.share_vectors, share_phq9=row.share_phq9)


@router.put("/settings", response_model=WellnessSettingsResponse)
async def update_wellness_settings(
    body: WellnessSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_or_create_opt_in(db, current_user.id)
    row.share_vectors = body.share_vectors
    row.share_phq9 = body.share_phq9
    db.commit()
    db.refresh(row)
    return WellnessSettingsResponse(share_vectors=row.share_vectors, share_phq9=row.share_phq9)


@router.post("/vector-sample")
async def submit_vector_sample(
    body: VectorSampleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_or_create_opt_in(db, current_user.id)
    if not row.share_vectors:
        raise HTTPException(status_code=403, detail="User has not opted in to share vectors")

    sample = WellnessVectorSample(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        dim=body.dim,
        time_epoch=body.time_epoch,
        session_id=body.session_id,
        vector_json=body.vector,
    )
    db.add(sample)
    db.commit()
    return {"success": True, "id": sample.id}


@router.post("/phq9-label")
async def submit_phq9_label(
    body: Phq9LabelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_or_create_opt_in(db, current_user.id)
    if not row.share_phq9:
        raise HTTPException(status_code=403, detail="User has not opted in to share PHQ-9 labels")

    label = WellnessPhq9Label(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        total_score=body.total_score,
        answers_json=body.answers,
    )
    db.add(label)
    db.commit()
    return {"success": True, "id": label.id}
