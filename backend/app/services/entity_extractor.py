"""Entity extraction: spaCy NER + regex rules, converted to user-friendly facts.

Raw spaCy output is noisy on resumes (it often tags "Python" as an ORG), so
entities are filtered against the skill dictionary, de-duplicated, and
combined with rule-based education / date detection.
"""
import re
from collections import Counter

from app.services.nlp_resources import get_spacy
from app.services.section_detector import _ALIAS_TO_KEY, SectionResult
from app.services.skill_extractor import get_skill_extractor

DEGREE_RE = re.compile(
    r"\b(?:B\.?\s?Tech|B\.?\s?Sc|B\.?\s?Com|BCA|BBA|M\.?\s?Tech|M\.?\s?Sc|MCA|MBA|Ph\.?\s?D|B\.E\.?|M\.E\.?|B\.A\.?|M\.A\.?"
    r"|Bachelor(?:'s|s)?(?:\s+of\s+[A-Z][A-Za-z]+(?:\s+(?:in\s+)?[A-Z][A-Za-z]+){0,3})?"
    r"|Master(?:'s|s)?(?:\s+of\s+[A-Z][A-Za-z]+(?:\s+(?:in\s+)?[A-Z][A-Za-z]+){0,3})?"
    r"|Diploma(?:\s+in\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})?)",
)
INSTITUTION_RE = re.compile(
    r"((?:[A-Z][\w&'.-]*\s+){0,4}(?:University|Institute|College|Academy|School)(?:\s+of\s+(?:[A-Z][\w&'-]*\s*){1,4})?)"
)
MONTH = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?"
DATE_RANGE_RE = re.compile(
    rf"(?:{MONTH}\s+)?(?:19|20)\d{{2}}\s*(?:-|–|—|to)\s*(?:(?:{MONTH}\s+)?(?:19|20)\d{{2}}|Present|Current|Ongoing)",
    re.IGNORECASE,
)
GPA_RE = re.compile(r"\b(?:CGPA|GPA|Percentage|Score)\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?\s*(?:/\s*\d{1,2}(?:\.\d)?|%)?)", re.IGNORECASE)
YEARS_RE = re.compile(r"\b(\d{1,2})\+?\s*(?:years?|yrs?)\b", re.IGNORECASE)

_ROLE_WORDS = {"intern", "engineer", "developer", "analyst", "designer", "manager", "lead", "associate",
               "trainee", "assistant", "consultant", "administrator", "architect", "scientist", "student"}
_FIELDS = {"computer science", "information technology", "electronics", "mechanical", "civil",
           "data science", "artificial intelligence", "engineering", "mathematics", "physics"}

_NOISE = set(_ALIAS_TO_KEY) | {"resume", "cv", "curriculum vitae", "github", "linkedin", "email", "phone"}


def guess_name(cleaned: str, nlp) -> str | None:
    lines = [l for l in cleaned.split("\n") if l.strip()][:6]
    for line in lines[:3]:
        words = line.replace(",", " ").split()
        if (2 <= len(words) <= 4 and all(re.fullmatch(r"[A-Za-z.'-]+", w) for w in words)
                and line.strip().lower() not in _NOISE
                and not any(w.lower() in _NOISE for w in words)):
            return " ".join(w.capitalize() if w.isupper() else w for w in words)
    if nlp is not None:
        doc = nlp("\n".join(lines))
        for ent in doc.ents:
            if ent.label_ == "PERSON" and len(ent.text.split()) >= 2:
                return ent.text.strip()
    return None


_MONTH_NUM = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
_RANGE_PARTS = re.compile(
    r"(?:(?P<m1>[A-Za-z]{3})[a-z]*\.?\s+)?(?P<y1>(?:19|20)\d{2})\s*(?:-|–|—|to)\s*"
    r"(?:(?:(?P<m2>[A-Za-z]{3})[a-z]*\.?\s+)?(?P<y2>(?:19|20)\d{2})|(?P<now>Present|Current|Ongoing))",
    re.IGNORECASE)


def estimate_experience_years(text: str) -> float | None:
    """Sum the length of date ranges (e.g. 'Jun 2025 - Aug 2025') found in experience text."""
    from datetime import date

    today, total = date.today(), 0
    found = False
    for m in _RANGE_PARTS.finditer(text):
        m1 = _MONTH_NUM.get((m.group("m1") or "jan").lower(), 1)
        y1 = int(m.group("y1"))
        if m.group("now"):
            y2, m2 = today.year, today.month
        else:
            y2, m2 = int(m.group("y2")), _MONTH_NUM.get((m.group("m2") or "dec").lower(), 12)
        months = (y2 - y1) * 12 + (m2 - m1) + 1
        if 0 < months <= 12 * 40:
            total += months
            found = True
    return round(total / 12, 1) if found else None


def _top(counter: Counter, n: int) -> list[str]:
    return [k for k, _ in counter.most_common(n)]


def extract_entities(cleaned: str, nlp_text: str, sections: SectionResult, max_chars: int = 100000) -> dict:
    nlp = get_spacy()
    skill_names = {n.lower() for n in get_skill_extractor().skill_category}
    skill_aliases = set(get_skill_extractor().protected_tokens)

    orgs: Counter = Counter()
    locs: Counter = Counter()
    dates: Counter = Counter()
    persons: Counter = Counter()

    name = guess_name(cleaned, nlp)
    name_low = (name or "").lower()

    if nlp is not None:
        skip = {l.lstrip("- ").strip() for key in ("projects", "skills") for l in sections.text(key).split("\n")}
        lines = [l.lstrip("- ").strip() for l in cleaned[:max_chars].split("\n")]
        lines = [l for l in lines if l and l not in skip and not re.match(r"^[A-Za-z /&]{2,25}:\s", l) and l.count(",") < 3]
        ents = [ent for doc in nlp.pipe(lines, batch_size=64) for ent in doc.ents]
        for ent in ents:
            text = re.sub(r"\s+", " ", ent.text).strip(" -,.|:")
            low = text.lower()
            if len(text) < 2 or low in skill_names or low in skill_aliases or low in _NOISE:
                continue
            if low == name_low or (set(low.split()) & _ROLE_WORDS):
                continue
            if ent.label_ == "ORG" and (DEGREE_RE.fullmatch(text)
                                        or any(t in skill_aliases for t in re.findall(r"[a-z0-9+#.]+", low))):
                continue
            if any(f in low for f in _FIELDS) or re.search(r"[:/,]", text) or len(text.split()) > 6:
                continue
            if "-" in text and text[0].isupper() and text.split("-")[-1].islower():
                continue  # e.g. "Final-year"
            if ent.label_ == "ORG" and not any(c.isdigit() for c in text) and len(text) <= 60:
                orgs[text] += 1
            elif ent.label_ in ("GPE", "LOC") and len(text) <= 40 and not any(c.isdigit() for c in text):
                locs[text] += 1
            elif ent.label_ == "PERSON":
                persons[text] += 1
            elif ent.label_ == "DATE" and re.search(r"(19|20)\d{2}", text):
                dates[text] += 1

    date_ranges = [re.sub(r"\s+", " ", m.group(0)) for m in DATE_RANGE_RE.finditer(cleaned)]
    education_text = sections.text("education") or cleaned
    degrees = list(dict.fromkeys(m.group(0).strip() for m in DEGREE_RE.finditer(education_text)))
    institutions = list(dict.fromkeys(
        re.sub(r"\s+", " ", m.group(1)).strip() for m in INSTITUTION_RE.finditer(education_text)
    ))
    grades = [m.group(0).strip() for m in GPA_RE.finditer(education_text)]
    years_claimed = [int(m.group(1)) for m in YEARS_RE.finditer(cleaned)]

    return {
        "name": name,
        "contact": sections.contact,
        "education": {
            "degrees": degrees[:4],
            "institutions": institutions[:4],
            "grades": grades[:3],
        },
        "organizations": _top(orgs, 8),
        "locations": _top(locs, 5),
        "dates": date_ranges[:8] or _top(dates, 6),
        "years_of_experience_mentioned": max(years_claimed) if years_claimed else None,
        "estimated_experience_years": estimate_experience_years(sections.text("experience")),
        "ner_available": nlp is not None,
    }
