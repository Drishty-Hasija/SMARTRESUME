"""Text cleaning and NLP preprocessing (NLTK).

Pipeline:  raw text -> clean_text -> nlp_text -> units (lines/sentences)
           -> tokenize -> POS-tag -> stop-word removal -> lemmatize
The original text is never modified; every stage returns a new value.
"""
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from functools import lru_cache

from nltk import pos_tag, sent_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import RegexpTokenizer

from app.services.nlp_resources import ensure_nltk
from app.services.skill_extractor import get_skill_extractor

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
URL_RE = re.compile(r"(?:https?://|www\.)\S+|(?:linkedin|github)\.com/\S+", re.IGNORECASE)
PHONE_RE = re.compile(r"(?<![\w.])\+?\(?\d[\d\s().-]{7,18}\d(?![\w])")
BULLET_RE = re.compile(r"^[\u2022\u25cf\u25aa\u25a0\u25e6\u25cb\u25c6\u25ba\u25b6\u00b7\u2023\u2043*•●▪■◦○◆►▶·‣⁃–—-]+\s*")
PAGE_NO_RE = re.compile(r"^(?:page\s+)?\d+(?:\s*(?:of|/)\s*\d+)?$", re.IGNORECASE)

# Tokens such as "c++", "c#", "node.js", "scikit-learn", "e-commerce", "95%".
_TOKENIZER = RegexpTokenizer(
    r"[A-Za-z][A-Za-z0-9]*(?:[+#]+|(?:[.\-][A-Za-z0-9]+)*)|\d+(?:[.,]\d+)*%?"
)

# Words that carry no signal in a resume / job description even though they
# are not general English stop-words.
DOMAIN_STOPWORDS = {
    "experience", "work", "working", "worked", "responsible", "responsibility", "use", "used",
    "using", "project", "skill", "year", "month", "team", "company", "like", "well", "also",
    "etc", "various", "include", "including", "strong", "good", "knowledge", "ability", "able",
    "candidate", "role", "job", "position", "look", "looking", "seek", "seeking", "opportunity",
    "excellent", "required", "require", "requirement", "preferred", "prefer", "must", "plus",
    "need", "would", "will", "can", "may", "new", "get", "make", "help", "ensure", "within",
    "across", "least", "minimum", "relevant", "related", "similar", "familiarity", "proficiency",
    "proficient", "understanding", "demonstrate", "demonstrated", "excellent", "highly",
    "responsibilities", "qualification", "qualifications", "apply", "join", "career", "ideal",
    "january", "february", "march", "april", "june", "july", "august", "september",
    "october", "november", "december", "jan", "feb", "mar", "apr", "jun", "jul", "aug",
    "sep", "sept", "oct", "nov", "dec", "present", "current", "currently", "etc.", "per", "one",
    "two", "three", "high", "level", "provide", "support", "e.g", "i.e", "ie", "eg", "internship",
    "intern", "summary", "objective", "profile", "contact", "email", "phone", "mobile",
    "degree", "field", "bachelor", "master", "pursuing", "nice", "have", "plus",
}

ACTION_VERBS = {
    "achieve", "analyze", "analyse", "architect", "automate", "build", "collaborate", "configure",
    "conduct", "contribute", "coordinate", "create", "decrease", "define", "deliver", "deploy",
    "design", "develop", "devise", "drive", "enhance", "establish", "evaluate", "execute",
    "implement", "improve", "increase", "initiate", "integrate", "introduce", "launch", "lead",
    "maintain", "manage", "mentor", "migrate", "model", "monitor", "optimize", "optimise",
    "organize", "organise", "perform", "plan", "present", "produce", "program", "publish",
    "reduce", "refactor", "release", "research", "resolve", "restructure", "review", "scale",
    "secure", "simplify", "solve", "spearhead", "streamline", "test", "train", "transform",
    "write", "participate", "assist", "prototype", "engineer", "generate", "extract", "win",
    "organised", "founded", "found", "run", "ship", "debug", "document", "collect", "visualize",
}


@dataclass
class ProcessedText:
    original: str
    cleaned: str
    nlp_text: str
    units: list[str] = field(default_factory=list)           # lines / sentences
    tokens: list[str] = field(default_factory=list)          # all lower-cased word tokens
    filtered_tokens: list[str] = field(default_factory=list) # without stop-words / punctuation
    lemmas: list[str] = field(default_factory=list)          # lemmatised, domain stop-words removed
    unit_lemmas: list[list[str]] = field(default_factory=list)
    lemma_pos: dict[str, str] = field(default_factory=dict)  # lemma -> dominant POS tag
    lemma_forms: dict[str, Counter] = field(default_factory=dict)  # lemma -> original surface forms

    @property
    def word_count(self) -> int:
        return len(self.tokens)

    def match_document(self) -> str:
        """Unit-delimited lemma string used by the TF-IDF vectoriser."""
        return "|".join(" ".join(u) for u in self.unit_lemmas if u)


# ----------------------------------------------------------------- cleaning
_LEADING_BULLET_RE = re.compile(r"^[\x7f\ue000-\uf8ff\u2022\u25cf\u25aa\u25a0\u25e6\u25cb\u25c6\u25ba\u25b6\u00b7\u2023\u2043*]+\s*")
_PUA_RE = re.compile(r"[\ue000-\uf8ff]")


def clean_text(raw: str) -> str:
    """Normalise whitespace/bullets, drop control chars, page numbers, duplicate lines."""
    text = unicodedata.normalize("NFKC", raw or "")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines: list[str] = []
    prev = None
    for line in text.split("\n"):
        line = line.strip(" \t\u00a0")
        had_bullet = bool(_LEADING_BULLET_RE.match(line))
        if had_bullet:
            line = _LEADING_BULLET_RE.sub("", line)
        line = _PUA_RE.sub(" ", line)
        line = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", line)
        line = re.sub(r"[ \t\u00a0]+", " ", line).strip()
        if not line:
            if lines and lines[-1] != "" and not had_bullet:
                lines.append("")
            continue
        if had_bullet:
            line = "- " + line
        if PAGE_NO_RE.match(line) or line == prev:
            continue
        # a lower-case line right after a bullet is its wrapped continuation (common in PDFs)
        if not had_bullet and line[0].islower() and lines and lines[-1].startswith("- "):
            lines[-1] += " " + line
            prev = lines[-1]
            continue
        lines.append(line)
        prev = line
    cleaned = "\n".join(lines).strip()
    return re.sub(r"\n{3,}", "\n\n", cleaned)


def to_nlp_text(cleaned: str) -> str:
    """Remove emails, URLs and phone numbers: they pollute keywords and skill matching."""
    text = EMAIL_RE.sub(" ", cleaned)
    text = URL_RE.sub(" ", text)
    return PHONE_RE.sub(lambda m: " " if 8 <= sum(c.isdigit() for c in m.group(0)) <= 15 else m.group(0), text)


# ------------------------------------------------------------------ helpers
@lru_cache(maxsize=1)
def _resources():
    ensure_nltk()
    return set(stopwords.words("english")), WordNetLemmatizer()


def _wn_pos(tag: str) -> str:
    return {"J": "a", "V": "v", "R": "r"}.get(tag[0], "n")


def split_units(text: str) -> list[str]:
    """Split text into lines, then long lines into sentences."""
    ensure_nltk()
    units: list[str] = []
    for line in text.split("\n"):
        line = BULLET_RE.sub("", line).strip()
        if not line:
            continue
        units.extend(sent_tokenize(line) if len(line) > 110 else [line])
    return units


def lemmatize_word(word: str, tag: str = "NN", original: str | None = None) -> str:
    """Lemmatise one lower-case token, leaving acronyms and tech names untouched."""
    _, lemmatizer = _resources()
    original = original or word
    if word == "apis":
        return "api"
    if (
        word in get_skill_extractor().protected_tokens
        or (original.isupper() and len(original) >= 2)
        or not word.isalpha()
    ):
        return word
    return lemmatizer.lemmatize(word, _wn_pos(tag))


# --------------------------------------------------------------- main entry
def preprocess(raw_text: str) -> ProcessedText:
    stop, _ = _resources()
    cleaned = clean_text(raw_text)
    nlp_text = to_nlp_text(cleaned)
    result = ProcessedText(original=raw_text, cleaned=cleaned, nlp_text=nlp_text)
    result.units = split_units(nlp_text)

    pos_votes: dict[str, Counter] = defaultdict(Counter)
    forms: dict[str, Counter] = defaultdict(Counter)

    segment_split = re.compile(r"[,;:|()\u2022]")
    for unit in result.units:
        for segment in segment_split.split(unit):
            raw_tokens = _TOKENIZER.tokenize(segment)
            tagged = pos_tag(raw_tokens) if raw_tokens else []
            current: list[str] = []
            for original, tag in tagged:
                lower = original.lower()
                result.tokens.append(lower)
                dropped = (
                    lower in stop or len(lower) < 2 or lower[0].isdigit() or lower.endswith("%")
                )
                if not dropped:
                    result.filtered_tokens.append(lower)
                    lemma = lemmatize_word(lower, tag, original)
                    if lemma in DOMAIN_STOPWORDS or lemma in stop:
                        dropped = True
                if dropped:
                    # a removed word breaks the phrase: no bigram may span it
                    if current:
                        result.unit_lemmas.append(current)
                        current = []
                    continue
                current.append(lemma)
                result.lemmas.append(lemma)
                pos_votes[lemma][tag] += 1
                forms[lemma][original] += 1
            if current:
                result.unit_lemmas.append(current)

    result.lemma_pos = {l: c.most_common(1)[0][0] for l, c in pos_votes.items()}
    result.lemma_forms = dict(forms)
    return result
