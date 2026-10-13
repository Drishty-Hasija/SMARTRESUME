"""Pydantic request/response models."""
import re
from datetime import datetime, timezone
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, field_validator


def _iso_utc(d: datetime) -> str:
    return d.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


UTCDatetime = Annotated[datetime, PlainSerializer(_iso_utc, return_type=str)]


class Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------- user
class UserOut(Base):
    id: int
    name: str
    email: str
    created_at: UTCDatetime


class UserUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(max_length=255)

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = re.sub(r"[\x00-\x1f<>]", "", v).strip()
        if not v:
            raise ValueError("Name cannot be empty.")
        return v

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.fullmatch(r"[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+", v):
            raise ValueError("Enter a valid email address.")
        return v


# -------------------------------------------------------------- resume
class AnalysisOut(Base):
    id: int
    resume_id: int
    score: float
    score_label: str
    score_breakdown: dict[str, Any]
    skills: dict[str, Any]
    keywords: list[dict[str, Any]]
    sections: list[dict[str, Any]]
    entities: dict[str, Any]
    suggestions: list[dict[str, Any]]
    stats: dict[str, Any]
    created_at: UTCDatetime


class MatchSummary(BaseModel):
    id: int
    resume_id: int
    job_id: int
    job_title: str
    resume_filename: str
    match_score: float
    verdict: str
    matching_skill_count: int
    missing_skill_count: int
    created_at: UTCDatetime


class ResumeSummary(BaseModel):
    id: int
    filename: str
    file_type: str
    file_size: int
    uploaded_at: UTCDatetime
    status: str
    error: str | None = None
    score: float | None = None
    score_label: str | None = None
    word_count: int | None = None
    skill_count: int | None = None
    latest_match_score: float | None = None


class ResumeDetail(ResumeSummary):
    raw_text: str
    analysis: AnalysisOut | None = None
    analysis_count: int = 0
    matches: list[MatchSummary] = []


# ----------------------------------------------------------------- job
class JobCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    description: str

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = re.sub(r"[\x00-\x1f<>]", "", v).strip()
        return v or None


class JobSummary(BaseModel):
    id: int
    title: str
    source_filename: str | None = None
    created_at: UTCDatetime
    word_count: int
    skill_count: int
    preview: str


class JobDetail(JobSummary):
    description: str
    analysis: dict[str, Any]


# --------------------------------------------------------------- match
class MatchCreate(BaseModel):
    resume_id: int = Field(gt=0)
    job_id: int = Field(gt=0)


class MatchDetail(MatchSummary):
    matching_skills: list[dict[str, Any]]
    missing_skills: list[dict[str, Any]]
    matching_keywords: list[str]
    missing_keywords: list[str]
    details: dict[str, Any]


# ------------------------------------------------------ dashboard/history
class HistoryItem(BaseModel):
    resume_id: int
    filename: str
    file_type: str
    date: UTCDatetime
    score: float | None
    score_label: str | None
    status: str
    match_id: int | None = None
    match_score: float | None = None
    match_job_title: str | None = None
    match_count: int = 0


class HistoryOut(BaseModel):
    items: list[HistoryItem]
    total: int


class DashboardOut(BaseModel):
    user: UserOut
    totals: dict[str, Any]
    latest_resume: ResumeSummary | None
    latest_analysis: AnalysisOut | None
    latest_match: MatchDetail | None
    top_skills: list[dict[str, Any]]
    skill_categories: dict[str, int]
    recent: list[HistoryItem]
