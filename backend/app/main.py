import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.db.database import engine, Base
from app.models import *  # noqa: F401, F403 — Import all models to register them
from app.routers.auth import router as auth_router
from app.routers.sessions import router as sessions_router
from app.routers.answers import router as answers_router
from app.routers.users import router as users_router
from app.routers.websocket import router as websocket_router

settings = get_settings()

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — startup and shutdown."""
    logger.info("Starting AI Interview Simulator API")

    # Create tables if using SQLite (development mode)
    if settings.is_sqlite:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("SQLite database tables created")

    yield
    logger.info("Shutting down AI Interview Simulator API")


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-Proctored Adaptive Interview Simulator API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(sessions_router)
app.include_router(answers_router)
app.include_router(users_router)
app.include_router(websocket_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "app": settings.APP_NAME}
