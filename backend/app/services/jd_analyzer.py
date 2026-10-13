"""Job description analysis using the same NLP pipeline as resumes."""
import re

from app.services.keyword_extractor import extract_keywords
from app.services.preprocessing import ProcessedText, preprocess, split_units
from app.services.skill_extractor import get_skill_extractor

_PREFERRED_RE = re.compile(
    r"\b(?:preferred|nice to have|good to have|a plus|is a plus|bonus|desirable|added advantage|optional)\b", re.I)
_REQUIRED_HEADING_RE = re.compile(
    r"^(?:requirements?|required|qualifications?|must[- ]have|what you(?:'ll)? need|responsibilities|"
    r"what you(?:'ll)? do|about you|skills)\b", re.I)
_QUAL_RE = re.compile(
    r"\b(?:bachelor|master|b\.?\s?tech|m\.?\s?tech|b\.?\s?sc|m\.?\s?sc|b\.?\s?e\b|bca|mca|mba|ph\.?d|degree|diploma|"
    r"pursuing|currently enrolled|final[- ]year|graduat\w*|certification)\b", re.I)
_YEARS_RE = re.compile(r"(\d{1,2})\s*(?:\+|-\s*\d{1,2})?\s*(?:years?|yrs?)", re.I)
_ENTRY_RE = re.compile(r"\b(?:intern(?:ship)?|fresher|entry[- ]level|graduate|trainee|junior)\b", re.I)


def _clip(s: str, n: int = 220) -> str:
    s = re.sub(r"\s+", " ", s).strip(" -•")
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def guess_title(text: str) -> str:
    for line in text.split("\n"):
        line = line.strip(" -•#*")
        if 3 <= len(line) <= 90 and not line.endswith("."):
            return line
    return "Untitled job"


def analyze_job_description(text: str, processed: ProcessedText | None = None) -> dict:
    p = processed or preprocess(text)
    extractor = get_skill_extractor()

    # classify each skill as required / preferred depending on where it appears
    required: dict[str, dict] = {}
    preferred: dict[str, dict] = {}
    mode = "required"
    for line in p.cleaned.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue
        is_heading = len(stripped) < 60 and not stripped.startswith("-")
        if is_heading and _PREFERRED_RE.search(stripped):
            mode = "preferred"
        elif is_heading and _REQUIRED_HEADING_RE.match(stripped.strip(": ")):
            mode = "required"
        line_pref = mode == "preferred" or bool(_PREFERRED_RE.search(stripped))
        for hit in extractor.extract(stripped):
            bucket = preferred if line_pref else required
            if hit["name"] not in bucket:
                bucket[hit["name"]] = {"name": hit["name"], "category": hit["category"], "count": 0}
            bucket[hit["name"]]["count"] += hit["count"]

    skills = []
    for name, info in required.items():
        skills.append({**info, "importance": "required"})
    for name, info in preferred.items():
        if name not in required:
            skills.append({**info, "importance": "preferred"})
    skills.sort(key=lambda s: (s["importance"] != "required", -s["count"], s["name"].lower()))

    keywords = extract_keywords(p, extractor.extract(p.nlp_text), top_n=45)
    technologies = [s for s in skills if s["category"] != "Soft Skills"]

    units = split_units(p.cleaned)
    qualifications = [_clip(u) for u in units if _QUAL_RE.search(u)][:5]
    exp_lines = [u for u in units if _YEARS_RE.search(u) and re.search(r"experience|exposure|background|work", u, re.I)]
    years = [int(m.group(1)) for u in exp_lines for m in [_YEARS_RE.search(u)] if m]
    experience = {
        "min_years": min(years) if years else None,
        "statements": [_clip(u) for u in exp_lines][:4],
        "entry_level": bool(_ENTRY_RE.search(p.cleaned)) and not years,
    }
    return {
        "skills": skills,
        "technologies": [s["name"] for s in technologies],
        "keywords": keywords,
        "qualifications": qualifications,
        "experience": experience,
        "stats": {
            "word_count": p.word_count,
            "required_skills": sum(1 for s in skills if s["importance"] == "required"),
            "preferred_skills": sum(1 for s in skills if s["importance"] == "preferred"),
        },
    }
