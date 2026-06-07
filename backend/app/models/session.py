import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    topic: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[str] = mapped_column(
        String(20), default="medium"
    )
    duration_minutes: Mapped[int] = mapped_column(
        Integer, default=30
    )
    status: Mapped[str] = mapped_column(
        String(20), default="active"
    )
    integrity_score: Mapped[int] = mapped_column(
        Integer, default=100
    )
    total_questions: Mapped[int] = mapped_column(
        Integer, default=10
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    user = relationship("User", back_populates="sessions")
    exchanges = relationship(
        "Exchange", back_populates="session", lazy="selectin",
        order_by="Exchange.question_index"
    )
