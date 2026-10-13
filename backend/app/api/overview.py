"""Dashboard, history, settings, skills dictionary and sample data endpoints."""
from collections import Counter
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.api.serializers import history_item, match_detail, resume_summary
from app.config import get_settings
from app.database.session import get_db
from app.models.entities import JobDescription, JobMatch, Resume, User
from app.schemas.api import AnalysisOut, DashboardOut, HistoryOut, ResumeDetail, UserOut, UserUpdate
from app.api.serializers import resume_detail
from app.services import workflows
from app.services.skill_extractor import get_skill_extractor
from app.utils.errors import AppError, NotFound

router = APIRouter(prefix="/api", tags=["overview"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(db: Session = Depends(get_db), user: User = Depends(current_user)):
    resumes = db.scalars(select(Resume).where(Resume.user_id == user.id).order_by(Resume.uploaded_at.desc())).all()
    analysed = [r for r in resumes if r.latest_analysis]
    latest = analysed[0] if analysed else None
    n_jobs = db.scalar(select(func.count()).select_from(JobDescription).where(JobDescription.user_id == user.id)) or 0
    matches = db.scalars(select(JobMatch).join(Resume).where(Resume.user_id == user.id)
                         .order_by(JobMatch.created_at.desc())).all()
    scores = [r.latest_analysis.score for r in analysed]

    top_skills, categories = [], {}
    if latest:
        items = latest.latest_analysis.skills.get("items", [])
        top_skills = [{"name": s["name"], "category": s["category"], "count": s["count"]} for s in items[:12]]
        categories = dict(Counter(s["category"] for s in items))
    return DashboardOut(
        user=UserOut.model_validate(user),
        totals={
            "resumes": len(resumes), "jobs": n_jobs, "matches": len(matches),
            "average_score": round(sum(scores) / len(scores), 1) if scores else None,
            "best_match": max((m.match_score for m in matches), default=None),
        },
        latest_resume=resume_summary(latest) if latest else None,
        latest_analysis=AnalysisOut.model_validate(latest.latest_analysis) if latest else None,
        latest_match=match_detail(matches[0]) if matches else None,
        top_skills=top_skills,
        skill_categories=categories,
        recent=[history_item(r) for r in resumes[:5]],
    )


@router.get("/history", response_model=HistoryOut)
def history(
    q: str | None = Query(default=None, max_length=100),
    status: Literal["complete", "processing", "failed"] | None = None,
    file_type: Literal["pdf", "docx", "txt"] | None = None,
    has_match: bool | None = None,
    sort: Literal["date", "score", "match", "name"] = "date",
    order: Literal["asc", "desc"] = "desc",
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Previous analyses with search, filtering and sorting."""
    rows = db.scalars(select(Resume).where(Resume.user_id == user.id)).all()
    items = [history_item(r) for r in rows]
    if q:
        needle = q.strip().lower()
        items = [i for i in items if needle in i.filename.lower() or needle in (i.match_job_title or "").lower()]
    if status:
        items = [i for i in items if i.status == status]
    if file_type:
        items = [i for i in items if i.file_type == file_type]
    if has_match is not None:
        items = [i for i in items if (i.match_id is not None) == has_match]
    key = {"date": lambda i: i.date, "score": lambda i: (i.score is None, i.score or 0),
           "match": lambda i: (i.match_score is None, i.match_score or 0), "name": lambda i: i.filename.lower()}[sort]
    items.sort(key=key, reverse=(order == "desc"))
    return HistoryOut(items=items[skip: skip + limit], total=len(items))


@router.get("/user", response_model=UserOut)
def get_user(user: User = Depends(current_user)):
    return user


@router.put("/user", response_model=UserOut)
def update_user(body: UserUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    user.name, user.email = body.name, body.email
    db.commit()
    return user


@router.get("/skills")
def skills_dictionary():
    """The skill dictionary the extractor is using (from data/skills.json)."""
    ex = get_skill_extractor()
    return {**ex.stats(), "skills_by_category": {c: list(s) for c, s in ex.categories.items()}}


@router.post("/samples/load", response_model=dict, status_code=201)
def load_sample(db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Create the sample resume and sample job description, so the app can be demoed immediately."""
    sample_dir = get_settings().sample_dir
    resume_file, job_file = sample_dir / "sample_resume.pdf", sample_dir / "sample_job_description.txt"
    if not resume_file.exists() or not job_file.exists():
        raise NotFound("Sample data")
    resume = workflows.create_resume(db, user, resume_file.name, resume_file.read_bytes())
    job = workflows.create_job_from_text(db, user, None, job_file.read_text(encoding="utf-8"))
    return {"resume_id": resume.id, "job_id": job.id}
