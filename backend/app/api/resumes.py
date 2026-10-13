from fastapi import APIRouter, Depends, File, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.api.serializers import resume_detail, resume_summary
from app.config import get_settings
from app.database.session import get_db
from app.models.entities import Resume, User
from app.schemas.api import ResumeDetail, ResumeSummary
from app.services import workflows
from app.utils.errors import ExtractionFailed

router = APIRouter(prefix="/api/resumes", tags=["resumes"])


@router.post("/upload", response_model=ResumeDetail, status_code=201)
def upload_resume(file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Upload a PDF/DOCX/TXT resume, extract its text, run the NLP analysis and store everything."""
    limit = get_settings().max_upload_bytes
    content = file.file.read(limit + 1)  # +1 so oversize files are detected without reading all of them
    if not file.filename:
        raise ExtractionFailed("No file was provided.")
    resume = workflows.create_resume(db, user, file.filename, content)
    return resume_detail(resume)


@router.get("", response_model=list[ResumeSummary])
def list_resumes(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = db.scalars(select(Resume).where(Resume.user_id == user.id).order_by(Resume.uploaded_at.desc())).all()
    return [resume_summary(r) for r in rows]


@router.get("/{resume_id}", response_model=ResumeDetail)
def get_resume(resume_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return resume_detail(workflows.get_resume(db, user, resume_id))


@router.post("/{resume_id}/analyze", response_model=ResumeDetail)
def reanalyze_resume(resume_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Re-run the analysis on the stored text and keep the new result as the latest."""
    resume = workflows.get_resume(db, user, resume_id)
    workflows.run_analysis(db, resume)
    return resume_detail(resume)


@router.delete("/{resume_id}", status_code=204)
def delete_resume(resume_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    workflows.delete_resume(db, workflows.get_resume(db, user, resume_id))
    return Response(status_code=204)
