import os
import sys
from datetime import datetime, timezone
import uuid

# 1. Path Setup: Add the backend directory to sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.db.database import Base
from app.models.user import User
from app.models.session import Session
from app.models.exchange import Exchange
from app.models.integrity import Score, IntegrityEvent, WeakTopic, Baseline
from app.config import get_settings

settings = get_settings()

# 2. SQLite In-Memory Database for Testing (Shared Cache for concurrent route connections)
TEST_DATABASE_URL = "sqlite+aiosqlite:///file:testdb?mode=memory&cache=shared&uri=true"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

TestingSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def init_test_db():
    """Create all tables in the temporary in-memory database."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def clean_test_db():
    """Drop all tables in the temporary in-memory database."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

async def override_get_db():
    """FastAPI get_db dependency override yielding test session."""
    async with TestingSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# 3. Helper data factories for tests
async def create_test_user(db: AsyncSession, email: str = "testuser@example.com", name: str = "Test User") -> User:
    from app.services.auth_service import hash_password
    user = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=hash_password("password123"),
        name=name
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

async def create_test_session(db: AsyncSession, user_id: uuid.UUID, topic: str = "Machine Learning") -> Session:
    session = Session(
        id=uuid.uuid4(),
        user_id=user_id,
        topic=topic,
        difficulty="medium",
        duration_minutes=30,
        status="active",
        integrity_score=100,
        total_questions=5
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session
