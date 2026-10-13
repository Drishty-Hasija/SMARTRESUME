"""Application configuration, loaded from environment variables / .env."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    app_name: str = "SmartResume"
    database_url: str = f"sqlite:///{BACKEND_DIR / 'smartresume.db'}"
    upload_dir: Path = BACKEND_DIR / "uploads"
    skills_path: Path = ROOT_DIR / "data" / "skills.json"
    sample_dir: Path = ROOT_DIR / "data"

    max_upload_mb: int = 10
    min_resume_chars: int = 120
    min_resume_words: int = 25
    min_job_chars: int = 40
    max_job_chars: int = 30000
    max_text_chars: int = 200000

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
