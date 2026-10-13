"""Application workflows: orchestrate parsing, NLP, and database persistence.

API routes call these functions and contain no processing logic themselves.
"""
import logging
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.entities import JobDescription, JobMatch, Resume, ResumeAnalysis, User
from app.services import storage
from app.services.document_parser import check_sufficient, extract_text
from app.services.jd_analyzer import analyze_job_description, guess_title
from app.services.job_matcher import match_resume_to_job
from app.services.preprocessing import preprocess
from app.services.resume_analyzer import analyze_resume
from app.utils.errors import AppError, NotFound

logger = logging.getLogger(__name__)
DEFAULT_EMAIL = "student@smartresume.local"
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def get_default_user(db: Session) -> User:
    """The app has no login: a single local user owns all data."""
    user = db.scalars(select(User).order_by(User.id)).first()
    if user is None:
        user = User(name="Student", email=DEFAULT_EMAIL)
        db.add(user)
        db.commit()
    return user


# ---------------------------------------------------------------- resumes
def run_analysis(db: Session, resume: Resume) -> ResumeAnalysis:
    try:
        report = analyze_resume(resume.raw_text)
    except Exception:
        logger.exception("Resume analysis failed for resume %s", resume.id)
        resume.status, resume.error = "failed", "The analysis could not be completed."
        db.commit()
        raise AppError("We couldn't analyse this resume. Please try again or upload a different file.",
                       500, "analysis_failed")
    analysis = ResumeAnalysis(resume_id=resume.id, **report)
    resume.status, resume.error = "complete", None
    db.add(analysis)
    db.commit()
    db.refresh(resume)
    return analysis


def create_resume(db: Session, user: User, filename: str, content: bytes) -> Resume:
    parsed = extract_text(filename, content, what="resume")
    stored = storage.save_upload(content, parsed.file_type)
    resume = Resume(
        user_id=user.id, filename=parsed.filename, file_type=parsed.file_type, file_size=parsed.size,
        stored_path=stored, raw_text=parsed.text, status="processing",
    )
    db.add(resume)
    db.commit()
    run_analysis(db, resume)
    return resume


def get_resume(db: Session, user: User, resume_id: int) -> Resume:
    resume = db.get(Resume, resume_id)
    if resume is None or resume.user_id != user.id:
        raise NotFound("Resume")
    return resume


def delete_resume(db: Session, resume: Resume) -> None:
    storage.delete_upload(resume.stored_path)
    db.delete(resume)
    db.commit()


# ------------------------------------------------------------------- jobs
def _build_job(db: Session, user: User, title: str | None, text: str, source_filename: str | None) -> JobDescription:
    settings = get_settings()
    text = _CONTROL.sub(" ", text or "").strip()
    if not text:
        raise AppError("The job description is empty.", 422, "empty_job_description",
                       "Paste the job description text or upload a file.")
    check_sufficient(text, "job description", settings.min_job_chars, 8)
    if len(text) > settings.max_job_chars:
        raise AppError(f"This job description is too long (limit {settings.max_job_chars:,} characters).",
                       413, "job_description_too_long", "Paste only the role and requirements sections.")
    try:
        analysis = analyze_job_description(text, preprocess(text))
    except Exception:
        logger.exception("Job description analysis failed")
        raise AppError("We couldn't analyse this job description. Please try again.", 500, "analysis_failed")
    job = JobDescription(
        user_id=user.id, title=(title or guess_title(text))[:200], description=text,
        source_filename=source_filename, analysis=analysis,
    )
    db.add(job)
    db.commit()
    return job


def create_job_from_text(db: Session, user: User, title: str | None, text: str) -> JobDescription:
    return _build_job(db, user, title, text, None)


def create_job_from_file(db: Session, user: User, title: str | None, filename: str, content: bytes) -> JobDescription:
    settings = get_settings()
    parsed = extract_text(filename, content, what="job description",
                          min_chars=settings.min_job_chars, min_words=8)
    return _build_job(db, user, title, parsed.text, parsed.filename)


def get_job(db: Session, user: User, job_id: int) -> JobDescription:
    job = db.get(JobDescription, job_id)
    if job is None or job.user_id != user.id:
        raise NotFound("Job description")
    return job


# ---------------------------------------------------------------- matching
def create_match(db: Session, user: User, resume_id: int, job_id: int) -> JobMatch:
    resume = get_resume(db, user, resume_id)
    job = get_job(db, user, job_id)
    analysis = resume.latest_analysis or run_analysis(db, resume)
    entities = analysis.entities or {}
    years = entities.get("estimated_experience_years")
    mentioned = entities.get("years_of_experience_mentioned")
    resume_years = max([y for y in (years, mentioned) if y is not None], default=None)
    try:
        result = match_resume_to_job(
            resume.raw_text, analysis.skills.get("items", []), job.description,
            job_analysis=job.analysis or None, resume_years=resume_years,
        )
    except Exception:
        logger.exception("Matching failed for resume %s / job %s", resume_id, job_id)
        raise AppError("We couldn't compare these documents. Please try again.", 500, "match_failed")
    match = JobMatch(
        resume_id=resume.id, job_id=job.id, match_score=result["match_score"],
        matching_skills=result["matching_skills"], missing_skills=result["missing_skills"],
        matching_keywords=result["matching_keywords"], missing_keywords=result["missing_keywords"],
        details={k: result[k] for k in ("verdict", "components", "extra_skills", "experience_check",
                                          "suggestions", "disclaimer")},
    )
    db.add(match)
    db.commit()
    return match


def get_match(db: Session, user: User, match_id: int) -> JobMatch:
    match = db.get(JobMatch, match_id)
    if match is None or match.resume.user_id != user.id:
        raise NotFound("Match")
    return match
