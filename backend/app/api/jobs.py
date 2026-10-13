from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.api.serializers import job_detail, job_summary
from app.config import get_settings
from app.database.session import get_db
from app.models.entities import JobDescription, User
from app.schemas.api import JobCreate, JobDetail, JobSummary
from app.services import workflows
from app.utils.errors import ExtractionFailed

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.post("", response_model=JobDetail, status_code=201)
def create_job(body: JobCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Create a job description from pasted text and analyse it."""
    return job_detail(workflows.create_job_from_text(db, user, body.title, body.description))


@router.post("/upload", response_model=JobDetail, status_code=201)
def upload_job(file: UploadFile = File(...), title: str | None = Form(default=None),
               db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Create a job description from an uploaded PDF/DOCX/TXT file."""
    if not file.filename:
        raise ExtractionFailed("No file was provided.")
    content = file.file.read(get_settings().max_upload_bytes + 1)
    return job_detail(workflows.create_job_from_file(db, user, (title or "").strip() or None, file.filename, content))


@router.get("", response_model=list[JobSummary])
def list_jobs(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.scalars(select(JobDescription).where(JobDescription.user_id == user.id)
                      .order_by(JobDescription.created_at.desc())).all()
    return [job_summary(j) for j in rows]


@router.get("/{job_id}", response_model=JobDetail)
def get_job(job_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return job_detail(workflows.get_job(db, user, job_id))


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(workflows.get_job(db, user, job_id))
    db.commit()
    return Response(status_code=204)
