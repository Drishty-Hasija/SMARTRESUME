"""Resume section detection (rule-based heading matching + contact regexes)."""
import re
from dataclasses import dataclass, field

from app.services.preprocessing import EMAIL_RE, PHONE_RE, URL_RE

# canonical key -> accepted headings (normalised: lower-case, letters and spaces only)
SECTION_ALIASES: dict[str, list[str]] = {
    "summary": ["summary", "professional summary", "career summary", "profile", "professional profile",
                "about me", "about", "personal statement"],
    "objective": ["objective", "career objective", "objectives"],
    "education": ["education", "academic background", "academic qualifications", "educational qualification",
                  "educational qualifications", "academics", "education and training", "qualifications"],
    "skills": ["skills", "technical skills", "core skills", "key skills", "core competencies", "skills and tools",
               "technical proficiency", "technologies", "tools and technologies", "skill set", "technical expertise",
               "skills summary"],
    "experience": ["experience", "work experience", "professional experience", "employment history",
                   "internships", "internship experience", "internship", "work history", "employment",
                   "relevant experience", "industry experience", "internships and experience"],
    "projects": ["projects", "academic projects", "personal projects", "key projects", "selected projects",
                 "technical projects", "project experience", "major projects", "side projects"],
    "certifications": ["certifications", "certificates", "licenses and certifications", "courses",
                       "certifications and courses", "training and certifications", "online courses",
                       "licenses"],
    "achievements": ["achievements", "awards", "honors", "honours", "accomplishments", "awards and achievements",
                     "achievements and awards", "honors and awards", "extracurricular activities",
                     "positions of responsibility", "leadership and activities", "extracurricular"],
    "languages": ["languages", "language skills", "languages known", "language proficiency"],
}
_ALIAS_TO_KEY = {alias: key for key, aliases in SECTION_ALIASES.items() for alias in aliases}
_OTHER_HEADINGS = {"interests", "hobbies", "references", "declaration", "personal details",
                   "personal information", "publications", "volunteering", "volunteer experience"}

# Display structure shown to the user: key, label, importance
DISPLAY_SECTIONS = [
    ("contact", "Contact Information", "essential"),
    ("summary", "Summary / Objective", "recommended"),
    ("education", "Education", "essential"),
    ("skills", "Skills", "essential"),
    ("experience", "Experience", "core"),
    ("projects", "Projects", "core"),
    ("certifications", "Certifications", "optional"),
    ("achievements", "Achievements", "optional"),
    ("languages", "Languages", "optional"),
]

_INLINE_HEADING = re.compile(r"^([A-Za-z &/]{3,40}?)\s*[:\-–—]\s+(\S.*)$")


@dataclass
class SectionResult:
    texts: dict[str, str] = field(default_factory=dict)       # key -> section body text
    contact: dict[str, str | None] = field(default_factory=dict)
    order: list[str] = field(default_factory=list)

    def has(self, key: str) -> bool:
        if key == "contact":
            return bool(self.contact.get("email") or self.contact.get("phone"))
        if key == "summary":
            return bool(self.texts.get("summary") or self.texts.get("objective"))
        return bool(self.texts.get(key, "").strip())

    def text(self, key: str) -> str:
        if key == "summary":
            return (self.texts.get("summary", "") + "\n" + self.texts.get("objective", "")).strip()
        return self.texts.get(key, "")


def _normalise_heading(line: str) -> str:
    line = re.sub(r"^[-\d.\s]+", "", line)
    line = line.replace("&", " and ")
    return re.sub(r"\s+", " ", re.sub(r"[^A-Za-z ]", " ", line)).strip().lower()


def _heading_key(line: str) -> str | None:
    if len(line) > 45 or len(line.split()) > 6:
        return None
    norm = _normalise_heading(line)
    if norm in _ALIAS_TO_KEY:
        return _ALIAS_TO_KEY[norm]
    if norm in _OTHER_HEADINGS:
        return "_other"
    return None


def detect_contact(text: str) -> dict[str, str | None]:
    email = EMAIL_RE.search(text)
    phone = None
    for m in PHONE_RE.finditer(text):
        if 8 <= sum(c.isdigit() for c in m.group(0)) <= 15:
            phone = m.group(0).strip()
            break
    linkedin = re.search(r"(?:https?://)?(?:www\.)?linkedin\.com/\S+", text, re.IGNORECASE)
    github = re.search(r"(?:https?://)?(?:www\.)?github\.com/\S+", text, re.IGNORECASE)
    other = None
    for m in URL_RE.finditer(text):
        u = m.group(0)
        if "linkedin" not in u.lower() and "github" not in u.lower():
            other = u
            break
    return {
        "email": email.group(0) if email else None,
        "phone": phone,
        "linkedin": linkedin.group(0).rstrip(".,;|") if linkedin else None,
        "github": github.group(0).rstrip(".,;|") if github else None,
        "website": other.rstrip(".,;|") if other else None,
    }


def detect_sections(cleaned: str) -> SectionResult:
    result = SectionResult(contact=detect_contact(cleaned))
    current: str | None = None
    buffers: dict[str, list[str]] = {}

    for line in cleaned.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue
        key = _heading_key(stripped)
        if key:
            current = key
            if key != "_other":
                buffers.setdefault(key, [])
                if key not in result.order:
                    result.order.append(key)
            continue
        inline = _INLINE_HEADING.match(stripped)
        if inline and not stripped.startswith("- "):
            ikey = _heading_key(inline.group(1))
            if ikey == "languages" and current == "skills":
                ikey = None  # "Languages: Python, Java" is a skill category label
            if ikey and ikey != "_other":
                current = ikey
                buffers.setdefault(ikey, []).append(inline.group(2))
                if ikey not in result.order:
                    result.order.append(ikey)
                continue
        if current and current != "_other":
            buffers[current].append(stripped)

    result.texts = {k: "\n".join(v).strip() for k, v in buffers.items()}
    return result


def section_report(sections: SectionResult) -> list[dict]:
    """User-facing section list with status and an explanatory note."""
    has_exp, has_proj = sections.has("experience"), sections.has("projects")
    report = []
    for key, label, importance in DISPLAY_SECTIONS:
        present = sections.has(key)
        note = ""
        if not present:
            if key in ("experience", "projects"):
                other_present = has_proj if key == "experience" else has_exp
                note = ("Not detected. Your other section can stand in for this, so it isn't penalised."
                        if other_present else "Not detected. Add at least one of Experience or Projects.")
            elif importance == "essential":
                note = "Not detected. Most recruiters expect this section."
            elif importance == "recommended":
                note = "Optional, but a 2-3 line summary helps readers."
            else:
                note = "Optional. Include it only if it applies to you."
        report.append({
            "key": key, "label": label, "present": present, "importance": importance,
            "status": "present" if present else ("missing" if importance in ("essential", "core") else "optional_missing"),
            "note": note,
        })
    return report
