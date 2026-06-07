from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    # Database — defaults to SQLite for easy development
    # Set DATABASE_URL to a PostgreSQL connection string for production
    DATABASE_URL: str = "sqlite+aiosqlite:///./interview.db"
    DATABASE_URL_SYNC: str = "sqlite:///./interview.db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # JWT
    JWT_SECRET: str = "change-this-to-a-random-secret-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # AI
    ANTHROPIC_API_KEY: str = ""

    # App
    APP_NAME: str = "AI Interview Simulator"
    DEBUG: bool = True
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    @property
    def is_sqlite(self) -> bool:
        return "sqlite" in self.DATABASE_URL

    model_config = {
        "env_file": os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()
