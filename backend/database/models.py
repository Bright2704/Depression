"""
SQLAlchemy ORM Models
"""

from sqlalchemy import Column, String, Integer, Boolean, DateTime, Enum, Text, JSON, DECIMAL, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .connection import Base
import uuid


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    nickname = Column(String(100), nullable=True)
    role = Column(Enum('user', 'admin'), default='user')
    age_range = Column(String(20), nullable=True)
    goal = Column(String(100), nullable=True)

    # OAuth
    oauth_provider = Column(Enum('google', 'facebook'), nullable=True)
    oauth_id = Column(String(255), nullable=True)

    # Profile
    avatar_url = Column(String(500), nullable=True)

    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)

    # Subscription (Stripe)
    is_pro = Column(Boolean, default=False)
    subscription_plan = Column(String(50), nullable=True)  # 'pro_monthly', 'pro_yearly'
    subscription_expires_at = Column(DateTime, nullable=True)
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    last_login_at = Column(DateTime, nullable=True)

    # Relationships
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    scan_history = relationship("ScanHistory", back_populates="user", cascade="all, delete-orphan")
    baseline = relationship("UserBaseline", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    refresh_token = Column(String(500), nullable=False)
    user_agent = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=True)

    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False)

    created_at = Column(DateTime, server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="sessions")


class ScanHistory(Base):
    __tablename__ = "scan_history"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # PHQ-9 scores
    phq9_score = Column(Integer, nullable=False)
    severity = Column(String(50), nullable=False)
    confidence = Column(DECIMAL(5, 4), nullable=False)

    # Wellness scores
    energy_level = Column(Integer, nullable=True)
    stress_level = Column(Integer, nullable=True)
    fatigue_level = Column(Integer, nullable=True)

    # JSON fields
    risk_indicators = Column(JSON, nullable=True)
    facial_summary = Column(JSON, nullable=True)

    # Session metadata
    session_id = Column(String(36), nullable=True)
    window_count = Column(Integer, nullable=True)
    total_frames = Column(Integer, nullable=True)
    scan_duration_seconds = Column(Integer, nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="scan_history")


class UserBaseline(Base):
    __tablename__ = "user_baselines"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)

    baseline_data = Column(JSON, nullable=False)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="baseline")


class AdminActivityLog(Base):
    __tablename__ = "admin_activity_log"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    admin_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    action = Column(String(50), nullable=False)
    target_type = Column(String(50), nullable=True)
    target_id = Column(String(36), nullable=True)

    details = Column(JSON, nullable=True)

    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)

    created_at = Column(DateTime, server_default=func.now())


class UserWellnessOptIn(Base):
    __tablename__ = "user_wellness_opt_in"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    share_vectors = Column(Boolean, default=False)
    share_phq9 = Column(Boolean, default=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class WellnessVectorSample(Base):
    __tablename__ = "wellness_vector_samples"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    dim = Column(Integer, nullable=False)
    time_epoch = Column(String(32), nullable=True)
    session_id = Column(String(36), nullable=True)
    vector_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class WellnessPhq9Label(Base):
    __tablename__ = "wellness_phq9_labels"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    total_score = Column(Integer, nullable=False)
    answers_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class WellnessTrainingJob(Base):
    __tablename__ = "wellness_training_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    status = Column(String(32), nullable=False)
    payload_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    finished_at = Column(DateTime, nullable=True)
