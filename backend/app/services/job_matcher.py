"""Resume <-> job description matching.

    overall = weighted blend of three explainable components
        skill match      (45%)  required skills count 1.0, preferred 0.5
        text similarity  (30%)  TF-IDF cosine similarity, rescaled (see below)
        keyword overlap  (25%)  share of the job's top non-skill keywords present in the resume

Raw cosine similarity between a resume and a job post is naturally low (a
strong match is typically around 0.4-0.5), so it is divided by
COSINE_FULL_SCORE and capped at 1 before blending. The raw value is always
reported separately as "text_similarity".
"""
import re

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.services.jd_analyzer import analyze_job_description
from app.services.keyword_extractor import unit_ngrams
from app.services.preprocessing import ProcessedText, preprocess

COSINE_FULL_SCORE = 0.5
WEIGHTS = {"skills": 0.45, "text": 0.30, "keywords": 0.25}
DISCLAIMER = ("This is an automated text-based comparison of your resume and the job description. "
              "It is not a prediction of hiring outcomes.")


def _join(items: list[str]) -> str:
    items = list(items)
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " and " + items[-1]


def tfidf_cosine(resume_doc: str, job_doc: str) -> float:
    """TF-IDF vectors (unigrams+bigrams within lines) and their cosine similarity."""
    if not resume_doc.strip() or not job_doc.strip():
        return 0.0
    vec = TfidfVectorizer(analyzer=unit_ngrams, sublinear_tf=True)
    try:
        matrix = vec.fit_transform([resume_doc, job_doc])
    except ValueError:
        return 0.0
    return float(cosine_similarity(matrix[0], matrix[1])[0, 0])


def _verdict(score: float) -> str:
    if score >= 75:
        return "Strong alignment"
    if score >= 55:
        return "Good alignment"
    if score >= 35:
        return "Partial alignment"
    return "Low alignment"


def match_resume_to_job(
    resume_text: str,
    resume_skills: list[dict] | None,
    job_text: str,
    job_analysis: dict | None = None,
    resume_processed: ProcessedText | None = None,
    resume_years: int | None = None,
) -> dict:
    rp = resume_processed or preprocess(resume_text)
    jp = preprocess(job_text)
    ja = job_analysis or analyze_job_description(job_text, jp)

    if resume_skills is None:
        from app.services.skill_extractor import get_skill_extractor
        resume_skills = get_skill_extractor().extract(rp.nlp_text)
    resume_skill_names = {s["name"] for s in resume_skills}

    # ---- text similarity (TF-IDF + cosine)
    cosine = tfidf_cosine(rp.match_document(), jp.match_document())

    # ---- skills
    job_skills = ja["skills"]
    matching = [s for s in job_skills if s["name"] in resume_skill_names]
    missing = [s for s in job_skills if s["name"] not in resume_skill_names]
    weight = lambda s: 1.0 if s["importance"] == "required" else 0.5
    total_w = sum(weight(s) for s in job_skills)
    skill_score = (sum(weight(s) for s in matching) / total_w) if total_w else None
    extra = sorted(resume_skill_names - {s["name"] for s in job_skills})

    # ---- keywords (non-skill terms only, skills are handled above)
    resume_grams = set()
    for unit in rp.match_document().split("|"):
        toks = unit.split()
        resume_grams.update(toks)
        resume_grams.update(f"{a} {b}" for a, b in zip(toks, toks[1:]))
    title_tokens = set()
    for line in job_text.split("\n"):
        if line.strip():
            title_tokens = {t for u in preprocess(line.strip(" -•#*")).unit_lemmas for t in u}
            break
    job_kw = [k for k in ja["keywords"]
              if not k["is_skill"] and not set(k["term"].split()) <= title_tokens][:20]
    kw_match = [k for k in job_kw if k["term"] in resume_grams]
    kw_missing = [k for k in job_kw if k["term"] not in resume_grams]
    keyword_score = (len(kw_match) / len(job_kw)) if len(job_kw) >= 5 else None  # too few terms to be meaningful

    # ---- blend (renormalise if a component is unavailable)
    parts = {"skills": skill_score, "text": min(1.0, cosine / COSINE_FULL_SCORE), "keywords": keyword_score}
    active = {k: v for k, v in parts.items() if v is not None}
    wsum = sum(WEIGHTS[k] for k in active)
    overall = 100 * sum(WEIGHTS[k] * v for k, v in active.items()) / wsum

    # ---- experience requirement
    req_years = ja["experience"]["min_years"]
    experience_check = {
        "required_years": req_years,
        "resume_years_mentioned": resume_years,
        "entry_level_role": ja["experience"]["entry_level"],
    }

    suggestions = _suggestions(missing, kw_missing, cosine, overall, experience_check, matching)

    def skill_out(s):
        return {"name": s["name"], "category": s["category"], "importance": s["importance"]}

    return {
        "match_score": round(overall, 1),
        "verdict": _verdict(overall),
        "components": {
            "skill_match": None if skill_score is None else round(skill_score * 100, 1),
            "text_similarity": round(cosine * 100, 1),
            "keyword_overlap": None if keyword_score is None else round(keyword_score * 100, 1),
            "weights": WEIGHTS,
        },
        "matching_skills": [skill_out(s) for s in matching],
        "missing_skills": [skill_out(s) for s in missing],
        "extra_skills": extra,
        "matching_keywords": [k["keyword"] for k in kw_match],
        "missing_keywords": [k["keyword"] for k in kw_missing],
        "experience_check": experience_check,
        "suggestions": suggestions,
        "disclaimer": DISCLAIMER,
    }


def _suggestions(missing, kw_missing, cosine, overall, exp, matching) -> list[dict]:
    out: list[dict] = []

    def add(priority, category, title, message):
        out.append({"priority": priority, "category": category, "title": title, "message": message})

    req_missing = [s["name"] for s in missing if s["importance"] == "required"]
    pref_missing = [s["name"] for s in missing if s["importance"] == "preferred"]
    if req_missing:
        shown = req_missing[:6]
        add("high", "Skills", "Address missing required skills",
            f"The job description mentions {_join(shown)}, but these skills were not detected in your resume. "
            "If you have used them in projects, coursework or internships, name them explicitly; otherwise consider learning them.")
    if pref_missing:
        add("medium", "Skills", "Nice-to-have skills not found",
            f"Preferred skills not detected: {_join(pref_missing[:6])}. These are less critical but would strengthen your application.")
    if kw_missing:
        add("medium", "Keywords", "Mirror the job's language",
            f"Terms such as {_join([k['keyword'] for k in kw_missing[:5]])} appear in the job description but not in your resume. "
            "Use them where they honestly describe your work.")
    if cosine < 0.15:
        add("medium", "Wording", "Tailor your wording",
            "Your resume's wording overlaps very little with this job description. Rework your summary and top bullet points to reflect the role's focus.")
    req = exp.get("required_years")
    if req and (exp.get("resume_years_mentioned") is None or exp["resume_years_mentioned"] < req):
        add("medium", "Experience", "Experience requirement",
            f"The job mentions {req}+ years of experience. Highlight relevant internships, long-running projects or freelance work to show comparable depth.")
    if overall >= 75 and not out:
        add("low", "Next step", "Strong overlap",
            "Your resume covers most of what this job asks for. Make sure your strongest matching skills appear near the top.")
    elif not out:
        add("low", "Next step", "Keep refining", "No major gaps were detected. Review the matching skills and make sure each is backed by a concrete example.")
    order = {"high": 0, "medium": 1, "low": 2}
    out.sort(key=lambda s: order[s["priority"]])
    return out
