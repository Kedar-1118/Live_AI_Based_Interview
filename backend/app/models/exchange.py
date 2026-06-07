import uuid
from datetime import datetime, timezone
from sqlalchemy import Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base


class Exchange(Base):
    __tablename__ = "exchanges"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sessions.id"), nullable=False, index=True
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    question_index: Mapped[int] = mapped_column(Integer, nullable=False)
    # embedding column deferred to Week 3 (pgvector)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    session = relationship("Session", back_populates="exchanges")
    score = relationship(
        "Score", back_populates="exchange", uselist=False, lazy="selectin"
    )
