import json
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator


# ─── Auth Schemas ─────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class RefreshRequest(BaseModel):
    refresh_token: str | None = None  # Can also come from httpOnly cookie


# ─── User Schemas ─────────────────────────────────────────────

class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Session Schemas ──────────────────────────────────────────

class SessionCreate(BaseModel):
    topic: str = Field(
        ...,
        description="Interview topic: Machine Learning, System Design, DSA, OS, Networking"
    )
    difficulty: str = Field(
        default="medium",
        pattern="^(easy|medium|hard)$"
    )
    duration_minutes: int = Field(default=30, ge=15, le=60)
    total_questions: int = Field(default=10, ge=5, le=20)


class SessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    topic: str
    difficulty: str
    duration_minutes: int
    status: str
    integrity_score: int
    total_questions: int
    started_at: datetime
    ended_at: datetime | None
    exchanges: list["ExchangeResponse"] = []

    model_config = {"from_attributes": True}


class SessionSummary(BaseModel):
    id: UUID
    topic: str
    difficulty: str
    status: str
    integrity_score: int
    total_questions: int
    questions_answered: int
    avg_score: float | None
    started_at: datetime
    ended_at: datetime | None


# ─── Exchange Schemas ─────────────────────────────────────────

class AnswerSubmit(BaseModel):
    session_id: UUID
    answer_text: str = Field(min_length=1)


class ExchangeResponse(BaseModel):
    id: UUID
    session_id: UUID
    question: str
    answer_transcript: str | None
    question_index: int
    created_at: datetime
    score: "ScoreResponse | None" = None

    model_config = {"from_attributes": True}


# ─── Score / Evaluation Schemas ───────────────────────────────

class EvaluationResult(BaseModel):
    technical_accuracy: int = Field(ge=1, le=10)
    definition_present: bool
    mechanism_explained: bool
    example_given: bool
    edge_cases_mentioned: bool
    missing_concepts: list[str] = []
    incorrect_statements: list[str] = []
    follow_up_angle: str
    answer_summary: str


class ScoreResponse(BaseModel):
    id: UUID
    exchange_id: UUID
    technical_accuracy: int | None
    definition_present: bool | None
    mechanism_explained: bool | None
    example_given: bool | None
    edge_cases_mentioned: bool | None
    missing_concepts: list[str] | None = None
    follow_up_angle: str | None

    model_config = {"from_attributes": True}

    @field_validator("missing_concepts", mode="before")
    @classmethod
    def parse_missing_concepts(cls, v):
        """Handle missing_concepts stored as JSON string in SQLite."""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return [v]
        return v


# ─── Answer Processing Response ───────────────────────────────

class AnswerProcessingResponse(BaseModel):
    exchange_id: UUID
    evaluation: EvaluationResult
    next_question: str | None
    question_index: int
    session_complete: bool = False


# ─── Dashboard Schemas ────────────────────────────────────────

class DashboardResponse(BaseModel):
    total_sessions: int
    completed_sessions: int
    avg_score: float | None
    total_questions_answered: int
    recent_sessions: list[SessionSummary]
