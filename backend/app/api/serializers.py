"""Convert ORM rows to response schemas."""
from app.models.entities import JobDescription, JobMatch, Resume
from app.schemas.api import (AnalysisOut, HistoryItem, JobDetail, JobSummary, MatchDetail, MatchSummary,
                             ResumeDetail, ResumeSummary)


def resume_summary(r: Resume) -> ResumeSummary:
    a, m = r.latest_analysis, r.latest_match
    return ResumeSummary(
        id=r.id, filename=r.filename, file_type=r.file_type, file_size=r.file_size, uploaded_at=r.uploaded_at,
        status=r.status, error=r.error,
        score=a.score if a else None, score_label=a.score_label if a else None,
        word_count=a.stats.get("word_count") if a else None,
        skill_count=a.stats.get("skill_count") if a else None,
        latest_match_score=m.match_score if m else None,
    )


def match_summary(m: JobMatch) -> MatchSummary:
    return MatchSummary(
        id=m.id, resume_id=m.resume_id, job_id=m.job_id, job_title=m.job.title, resume_filename=m.resume.filename,
        match_score=m.match_score, verdict=m.details.get("verdict", ""),
        matching_skill_count=len(m.matching_skills), missing_skill_count=len(m.missing_skills),
        created_at=m.created_at,
    )


def match_detail(m: JobMatch) -> MatchDetail:
    return MatchDetail(
        **match_summary(m).model_dump(), matching_skills=m.matching_skills, missing_skills=m.missing_skills,
        matching_keywords=m.matching_keywords, missing_keywords=m.missing_keywords, details=m.details,
    )


def resume_detail(r: Resume) -> ResumeDetail:
    a = r.latest_analysis
    return ResumeDetail(
        **resume_summary(r).model_dump(), raw_text=r.raw_text,
        analysis=AnalysisOut.model_validate(a) if a else None,
        analysis_count=len(r.analyses),
        matches=[match_summary(m) for m in reversed(r.matches)],
    )


def job_summary(j: JobDescription) -> JobSummary:
    stats = (j.analysis or {}).get("stats", {})
    return JobSummary(
        id=j.id, title=j.title, source_filename=j.source_filename, created_at=j.created_at,
        word_count=stats.get("word_count", len(j.description.split())),
        skill_count=len((j.analysis or {}).get("skills", [])),
        preview=j.description[:160].replace("\n", " "),
    )


def job_detail(j: JobDescription) -> JobDetail:
    return JobDetail(**job_summary(j).model_dump(), description=j.description, analysis=j.analysis or {})


def history_item(r: Resume) -> HistoryItem:
    a, m = r.latest_analysis, r.latest_match
    return HistoryItem(
        resume_id=r.id, filename=r.filename, file_type=r.file_type, date=r.uploaded_at,
        score=a.score if a else None, score_label=a.score_label if a else None, status=r.status,
        match_id=m.id if m else None, match_score=m.match_score if m else None,
        match_job_title=m.job.title if m else None, match_count=len(r.matches),
    )
