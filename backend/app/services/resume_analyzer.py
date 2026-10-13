"""Resume analysis: NLP pipeline + transparent scoring + dynamic suggestions.

Resume Analysis Score (0-100) is a weighted average of seven measurable
components. It is NOT an ATS score; see docs for the exact formulas.

    component            weight
    sections             20
    skills               25
    keywords             15
    experience           15
    projects             10
    contact              10
    structure             5

Experience and Projects are "either/or": if a resume has strong content in one
and no section for the other (typical for students: projects but no job
history) the missing one is marked not-applicable and its weight is
redistributed, so students are not penalised unfairly.
"""
import re

from app.services.entity_extractor import DATE_RANGE_RE, extract_entities
from app.services.keyword_extractor import extract_keywords
from app.services.preprocessing import ACTION_VERBS, ProcessedText, lemmatize_word, preprocess
from app.services.section_detector import SectionResult, detect_sections, section_report
from app.services.skill_extractor import get_skill_extractor

WEIGHTS = {
    "sections": 20, "skills": 25, "keywords": 15, "experience": 15,
    "projects": 10, "contact": 10, "structure": 5,
}
LABELS = {
    "sections": "Section Completeness", "skills": "Skills", "keywords": "Keywords",
    "experience": "Experience", "projects": "Projects", "contact": "Contact Information",
    "structure": "Structure",
}
_MONTHS = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?"
_YEAR_OR_DATE = re.compile(rf"\b(?:19|20)\d{{2}}\b|\b{_MONTHS}\b", re.IGNORECASE)


# ---------------------------------------------------------------- utilities
def _clamp(x: float) -> float:
    return max(0.0, min(100.0, x))


def _bullets(text: str) -> list[str]:
    return [l[2:].strip() if l.startswith("- ") else l.strip() for l in text.split("\n") if l.strip()]


def is_action_line(line: str) -> bool:
    words = re.findall(r"[A-Za-z]+", line)
    if not words:
        return False
    first = words[0].lower()
    return lemmatize_word(first, "VB") in ACTION_VERBS or first in ACTION_VERBS


def is_quantified(line: str) -> bool:
    """True if the line contains a number/percentage that is not just a date."""
    stripped = _YEAR_OR_DATE.sub(" ", line)
    return bool(re.search(r"\d", stripped))


def _content_metrics(text: str) -> dict:
    lines = _bullets(text)
    detail_lines = [l for l in text.split("\n") if l.strip().startswith("- ")] or lines
    bullets = [l[2:] if l.startswith("- ") else l for l in detail_lines]
    return {
        "lines": len(lines),
        "bullets": len(bullets),
        "action": sum(is_action_line(b) for b in bullets),
        "quantified": sum(is_quantified(b) for b in bullets),
    }


def _project_count(text: str) -> int:
    """Count project titles: non-bullet lines directly followed by a bullet point.

    Falls back to short capitalised non-bullet lines when the layout has no bullets.
    """
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    titles = [l for i, l in enumerate(lines[:-1]) if not l.startswith("- ") and lines[i + 1].startswith("- ")]
    if not titles:
        titles = [l for l in lines if not l.startswith("- ") and len(l) <= 80
                  and l[0].isupper() and not l.endswith(".")]
    return len(titles) if titles else (1 if text.strip() else 0)


# ------------------------------------------------------------- score pieces
def _score_sections(sections: SectionResult) -> tuple[float, str]:
    essentials = [sections.has("contact"), sections.has("education"), sections.has("skills"),
                  sections.has("experience") or sections.has("projects")]
    optionals = [sections.has("summary"), sections.has("certifications"), sections.has("achievements")]
    essential_frac = sum(essentials) / len(essentials)
    optional_frac = sum(optionals) / len(optionals)
    score = 85 * essential_frac + 15 * optional_frac
    detail = (f"{sum(essentials)} of 4 core sections found (contact, education, skills, "
              f"experience or projects); {sum(optionals)} of 3 optional sections.")
    return score, detail


def _score_skills(skills: list[dict]) -> tuple[float, str]:
    tech = [s for s in skills if s["category"] != "Soft Skills"]
    soft = [s for s in skills if s["category"] == "Soft Skills"]
    categories = {s["category"] for s in tech}
    effective = len(tech) + 0.5 * len(soft)
    score = 70 * min(1, effective / 10) + 30 * min(1, len(categories) / 3)
    detail = f"{len(tech)} technical and {len(soft)} soft skills detected across {len(categories)} technical categories."
    return score, detail


def _score_keywords(keywords: list[dict]) -> tuple[float, str]:
    n = len(keywords)
    skill_kw = sum(1 for k in keywords if k["is_skill"])
    score = 60 * min(1, n / 15) + 40 * min(1, skill_kw / 6)
    return score, f"{n} important terms extracted; {skill_kw} of them are recognised skills."


def _score_experience(text: str) -> tuple[float, str, dict]:
    if not text.strip():
        return 0.0, "No experience section detected.", {}
    m = _content_metrics(text)
    bullets = max(1, m["bullets"])
    content = 30 if m["lines"] >= 3 else 15
    action = 35 * (m["action"] / bullets)                 # share of bullets starting with an action verb
    quant = 35 * min(1, (m["quantified"] / bullets) / 0.5)  # full marks when half the bullets have numbers
    detail = (f"{m['bullets']} bullet points; {m['action']} start with an action verb; "
              f"{m['quantified']} include measurable results.")
    return content + action + quant, detail, m


def _score_projects(text: str, skills_in_section: int) -> tuple[float, str, dict]:
    if not text.strip():
        return 0.0, "No projects section detected.", {}
    m = _content_metrics(text)
    count = _project_count(text)
    bullets = max(1, m["bullets"])
    score = (40 * min(1, count / 2) + 30 * min(1, skills_in_section / 3)
             + 15 * (m["action"] / bullets) + 15 * min(1, (m["quantified"] / bullets) / 0.5))
    detail = f"{count} project(s) detected; {skills_in_section} skills mentioned in project descriptions."
    m["count"] = count
    return score, detail, m


def _score_contact(contact: dict) -> tuple[float, str]:
    score = (50 if contact.get("email") else 0) + (30 if contact.get("phone") else 0)
    has_link = any(contact.get(k) for k in ("linkedin", "github", "website"))
    score += 20 if has_link else 0
    found = [k for k in ("email", "phone", "linkedin", "github", "website") if contact.get(k)]
    return score, ("Found: " + ", ".join(found)) if found else "No contact details found."


def _score_structure(word_count: int, bullet_count: int, section_count: int) -> tuple[float, str]:
    if word_count < 150:
        length = 50 * word_count / 150
    elif word_count <= 1000:
        length = 50
    else:
        length = max(0.0, 50 - (word_count - 1000) / 20)
    score = length + 30 * min(1, bullet_count / 5) + 20 * min(1, section_count / 3)
    return score, f"{word_count} words, {bullet_count} bullet points, {section_count} clearly headed sections."


def _label(score: float) -> str:
    if score >= 80:
        return "Strong foundation"
    if score >= 65:
        return "Good, with room to improve"
    if score >= 50:
        return "Needs some work"
    return "Early draft"


# --------------------------------------------------------------- suggestions
_PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def _join(items: list[str]) -> str:
    items = list(items)
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " and " + items[-1]


def build_suggestions(sections: SectionResult, skills: list[dict], keywords: list[dict], contact: dict,
                      exp_m: dict, proj_m: dict, stats: dict) -> list[dict]:
    out: list[dict] = []

    def add(priority, category, title, message):
        out.append({"priority": priority, "category": category, "title": title, "message": message})

    wc = stats["word_count"]
    if not contact.get("email"):
        add("high", "Contact", "Add an email address", "No email address was detected. Recruiters need a way to reach you; add a professional email near the top.")
    if not contact.get("phone"):
        add("medium", "Contact", "Add a phone number", "No phone number was detected. Include one so recruiters can call or message you.")
    if contact.get("email") and not any(contact.get(k) for k in ("linkedin", "github", "website")):
        add("low", "Contact", "Link your profiles", "Consider adding a LinkedIn, GitHub or portfolio link so recruiters can see your work.")

    if not sections.has("education"):
        add("high", "Sections", "Add an Education section", "No Education section was detected. List your degree, institution and graduation year.")
    if not sections.has("skills"):
        found = len(skills)
        extra = f" We found {found} skills elsewhere in your resume; group them under a Skills heading." if found else ""
        add("high", "Sections", "Add a Skills section", "No dedicated Skills section was detected." + extra)

    has_exp, has_proj = sections.has("experience"), sections.has("projects")
    if not has_exp and not has_proj:
        add("high", "Projects", "Add projects or experience",
            "Consider adding 2-3 relevant projects with measurable outcomes. If you have internships or part-time work, add an Experience section too.")
    elif has_proj and proj_m.get("count", 0) == 1:
        add("medium", "Projects", "Add another project", "Only one project was detected. Consider adding 2-3 relevant projects that use different skills.")

    body = exp_m if has_exp else proj_m
    if body and body.get("bullets", 0) > 0:
        if body["quantified"] == 0:
            where = "experience" if has_exp else "project"
            add("medium", "Impact", "Add measurable results",
                f"None of the {body['bullets']} {where} bullet points include numbers. Consider adding measurable outcomes, such as users served, time saved, accuracy achieved or percentage improved.")
        if body["action"] < max(1, body["bullets"] // 2):
            add("medium", "Writing", "Start bullets with action verbs",
                f"Only {body['action']} of {body['bullets']} bullet points start with an action verb. Begin lines with verbs such as Built, Designed, Implemented or Led.")
    if has_exp and exp_m.get("bullets", 0) <= 1:
        add("medium", "Experience", "Describe your experience in more detail", "Your experience section is very short. Use 2-4 bullet points per role to explain what you did and what it achieved.")

    tech = [s for s in skills if s["category"] != "Soft Skills"]
    if len(tech) < 6:
        add("high" if len(tech) < 3 else "medium", "Skills", "List more relevant skills",
            f"Only {len(tech)} technical skills were detected. List the tools, languages and frameworks you have actually used.")
    elif len({s["category"] for s in tech}) == 1:
        add("low", "Skills", "Show a wider skill range", "All detected skills fall into one category. If applicable, mention complementary tools such as databases, version control or testing.")
    if skills and not any(s["category"] == "Soft Skills" for s in skills):
        add("low", "Skills", "Mention soft skills in context", "No soft skills were detected. Show teamwork or communication through concrete examples rather than a list.")

    if not sections.has("summary"):
        add("low", "Sections", "Add a short summary", "A 2-3 line summary at the top helps readers understand your focus quickly.")
    if not sections.has("certifications") and len(tech) >= 3:
        add("low", "Sections", "Consider adding certifications", "If you have completed relevant courses or certifications, list them in a Certifications section.")

    if wc < 150:
        add("high", "Format", "Resume looks very short", f"Only {wc} words were extracted. If this is a scanned or image-based PDF, upload a text-based version; otherwise add more detail.")
    elif wc > 900:
        add("medium", "Format", "Consider shortening", f"Your resume has about {wc} words. For students and early-career candidates, one to two pages is usually enough.")

    if not out:
        add("low", "Next step", "Tailor it to a job", "Your resume covers the key areas. Use Job Matching to compare it with a specific job description and see which skills to emphasise.")
    out.sort(key=lambda s: _PRIORITY_ORDER[s["priority"]])
    return out


# ---------------------------------------------------------------- main API
def analyze_resume(raw_text: str, processed: ProcessedText | None = None) -> dict:
    """Run the full resume analysis pipeline and return a JSON-serialisable report."""
    p = processed or preprocess(raw_text)
    extractor = get_skill_extractor()

    sections = detect_sections(p.cleaned)
    skills = extractor.extract(p.nlp_text)
    entities = extract_entities(p.cleaned, p.nlp_text, sections)
    exclude = set((entities.get("name") or "").lower().split())
    for place in entities.get("locations", []):
        exclude.update(place.lower().split())
    keywords = extract_keywords(p, skills, top_n=20, exclude=exclude)

    skills_in_projects = len(extractor.extract(sections.text("projects"))) if sections.has("projects") else 0
    exp_text, proj_text = sections.text("experience"), sections.text("projects")

    comp: dict[str, tuple[float, str]] = {}
    comp["sections"] = _score_sections(sections)
    comp["skills"] = _score_skills(skills)
    comp["keywords"] = _score_keywords(keywords)
    exp_score, exp_detail, exp_m = _score_experience(exp_text)
    proj_score, proj_detail, proj_m = _score_projects(proj_text, skills_in_projects)
    comp["experience"] = (exp_score, exp_detail)
    comp["projects"] = (proj_score, proj_detail)
    comp["contact"] = _score_contact(sections.contact)

    bullet_count = sum(1 for l in p.cleaned.split("\n") if l.startswith("- "))
    section_count = len(sections.order)
    comp["structure"] = _score_structure(p.word_count, bullet_count, section_count)

    applicable = {k: True for k in WEIGHTS}
    if not sections.has("experience") and sections.has("projects") and proj_score >= 40:
        applicable["experience"] = False
        comp["experience"] = (0.0, "Not applicable: your projects section covers this. Weight redistributed.")
    if not sections.has("projects") and sections.has("experience") and exp_score >= 40:
        applicable["projects"] = False
        comp["projects"] = (0.0, "Not applicable: your experience section covers this. Weight redistributed.")

    total_weight = sum(w for k, w in WEIGHTS.items() if applicable[k])
    score = sum(_clamp(comp[k][0]) * WEIGHTS[k] for k in WEIGHTS if applicable[k]) / total_weight

    breakdown = {
        k: {
            "label": LABELS[k],
            "score": round(_clamp(comp[k][0]), 1),
            "weight": WEIGHTS[k],
            "applicable": applicable[k],
            "detail": comp[k][1],
        }
        for k in WEIGHTS
    }

    stats = {
        "word_count": p.word_count,
        "char_count": len(p.cleaned),
        "line_count": len([l for l in p.cleaned.split("\n") if l.strip()]),
        "bullet_count": bullet_count,
        "sentence_count": len(p.units),
        "estimated_pages": round(max(1, p.word_count / 500), 1),
        "skill_count": len(skills),
        "section_count": section_count,
        "date_ranges_found": len(DATE_RANGE_RE.findall(p.cleaned)),
    }
    suggestions = build_suggestions(sections, skills, keywords, sections.contact, exp_m, proj_m, stats)

    return {
        "score": round(score, 1),
        "score_label": _label(score),
        "score_breakdown": breakdown,
        "skills": {
            "items": skills,
            "by_category": extractor.group_by_category(skills),
            "total": len(skills),
        },
        "keywords": keywords,
        "sections": section_report(sections),
        "entities": entities,
        "suggestions": suggestions,
        "stats": stats,
    }
