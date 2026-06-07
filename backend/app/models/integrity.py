import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Text, Integer, Float, Boolean, BigInteger, DateTime, ForeignKey, String
)
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base


class Score(Base):
    __tablename__ = "scores"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    exchange_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("exchanges.id"), nullable=False, unique=True, index=True
    )
    technical_accuracy: Mapped[int | None] = mapped_column(Integer)
    definition_present: Mapped[bool | None] = mapped_column(Boolean)
    mechanism_explained: Mapped[bool | None] = mapped_column(Boolean)
    example_given: Mapped[bool | None] = mapped_column(Boolean)
    edge_cases_mentioned: Mapped[bool | None] = mapped_column(Boolean)
    missing_concepts: Mapped[list | None] = mapped_column(ARRAY(Text))
    follow_up_angle: Mapped[str | None] = mapped_column(Text)
    wpm: Mapped[int | None] = mapped_column(Integer)
    filler_count: Mapped[int | None] = mapped_column(Integer)
    longest_pause_seconds: Mapped[float | None] = mapped_column(Float)
    confidence_proxy: Mapped[float | None] = mapped_column(Float)

    # Relationships
    exchange = relationship("Exchange", back_populates="score")


class IntegrityEvent(Base):
    __tablename__ = "integrity_events"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sessions.id"), nullable=False, index=True
    )
    exchange_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("exchanges.id"), nullable=True
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str | None] = mapped_column(String(20))
    timestamp_ms: Mapped[int | None] = mapped_column(BigInteger)
    metadata_json: Mapped[dict | None] = mapped_column(JSONB)


class WeakTopic(Base):
    __tablename__ = "weak_topics"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    topic: Mapped[str] = mapped_column(Text, nullable=False)
    subtopic: Mapped[str | None] = mapped_column(Text)
    avg_score: Mapped[float | None] = mapped_column(Float)
    occurrence: Mapped[int] = mapped_column(Integer, default=1)
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class Baseline(Base):
    __tablename__ = "baselines"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sessions.id"), nullable=False, index=True
    )
    avg_wpm: Mapped[float | None] = mapped_column(Float)
    wpm_std_dev: Mapped[float | None] = mapped_column(Float)
    gaze_center_x: Mapped[float | None] = mapped_column(Float)
    gaze_center_y: Mapped[float | None] = mapped_column(Float)
    gaze_std_dev: Mapped[float | None] = mapped_column(Float)
    head_pose_range: Mapped[dict | None] = mapped_column(JSONB)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
