"""Keyword extraction with TF-IDF over the lines/sentences of one document.

A single document has no corpus, so each *unit* (resume line or sentence) is
treated as a mini-document. IDF then down-weights words that appear in many
lines (generic) and keeps terms that are specific. Terms are scored as the
sum of raw TF-IDF over all units, filtered by part-of-speech (nouns /
adjectives), boosted when they are known skills, and de-duplicated so that
"machine learning" replaces the separate words "machine" and "learning".
"""
import re
from collections import Counter

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

from app.services.preprocessing import ACTION_VERBS, ProcessedText
from app.services.skill_extractor import get_skill_extractor

SKILL_BOOST = 1.5


def unit_ngrams(doc: str) -> list[str]:
    """Analyzer: unigrams + bigrams generated inside each '|'-separated unit."""
    grams: list[str] = []
    for unit in doc.split("|"):
        toks = unit.split()
        grams.extend(toks)
        grams.extend(f"{a} {b}" for a, b in zip(toks, toks[1:]))
    return grams


_ACRONYMS = {"api", "sql", "ui", "ux", "aws", "gcp", "ci", "cd", "ml", "ai", "nlp", "html", "css", "sdk",
             "ide", "gpu", "cpu", "oop", "orm", "etl", "iot", "qa", "seo", "crm", "erp", "rest", "json", "xml"}


def _display(term: str, p: ProcessedText) -> str:
    """Human-friendly form of a lemma phrase (keeps API, TensorFlow, etc.)."""
    words = []
    for lemma in term.split():
        forms = p.lemma_forms.get(lemma)
        chosen = None
        if forms:
            for form in forms:
                if (form.isupper() and len(form) >= 2) or re.search(r"[a-z][A-Z]", form):
                    chosen = form
                    break
        words.append(chosen or (lemma.upper() if lemma in _ACRONYMS else lemma.capitalize()))
    return " ".join(words)


def _is_noun_like(tag: str) -> bool:
    return tag.startswith("NN") or tag.startswith("JJ") or tag == "FW"


def extract_keywords(
    p: ProcessedText,
    skills: list[dict] | None = None,
    top_n: int = 15,
    exclude: set[str] | None = None,
) -> list[dict]:
    """Return [{keyword, score(0-1), is_skill}] ordered by importance."""
    docs = [" ".join(u) for u in p.unit_lemmas if u]
    if not docs:
        return []
    extractor = get_skill_extractor()
    skills = skills if skills is not None else extractor.extract(p.nlp_text)
    skill_alias = {a for s in skills for a in s["matched"]}
    skill_alias_tokens = {t for a in skill_alias for t in re.split(r"[\s]+", a)}
    alias_to_name = {a: s["name"] for s in skills for a in s["matched"]}
    exclude = {e.lower() for e in (exclude or set())}

    vectorizer = TfidfVectorizer(analyzer=unit_ngrams, sublinear_tf=False, norm=None)
    try:
        matrix = vectorizer.fit_transform(docs)
    except ValueError:
        return []
    scores = np.asarray(matrix.sum(axis=0)).ravel()
    terms = vectorizer.get_feature_names_out()

    candidates: dict[str, float] = {}
    for term, score in zip(terms, scores):
        parts = term.split()
        if any(t in exclude for t in parts):
            continue
        tags = [p.lemma_pos.get(t, "NN") for t in parts]
        is_skill = term in skill_alias
        if not is_skill:
            if any(len(t) < 3 for t in parts):
                continue
            if parts[0] in ACTION_VERBS:
                continue  # leading verbs of bullet points ("develop", "deploy ...") are not keywords
            if len(parts) == 1:
                if not tags[0].startswith("NN") or len(term) < 3:
                    continue
            else:
                if not (_is_noun_like(tags[0]) and tags[-1].startswith("NN")):
                    continue
            # constituents of a detected multi-word skill are not keywords on their own
            if all(t in skill_alias_tokens for t in parts):
                continue
        candidates[term] = float(score) * (SKILL_BOOST if is_skill else 1.0)

    # Skills whose alias is not a unigram/bigram (e.g. "natural language processing")
    max_score = max(candidates.values(), default=1.0)
    for s in skills:
        if not any(a in candidates for a in s["matched"]):
            candidates[s["matched"][0]] = max_score * 0.4 * min(1.0, 0.5 + s["count"] / 4)

    ranked = sorted(candidates.items(), key=lambda kv: -kv[1])

    selected: list[tuple[str, float]] = []
    for term, score in ranked:
        if len(selected) >= top_n:
            break
        parts = term.split()
        # drop a unigram already covered by a selected bigram of similar weight
        if len(parts) == 1 and any(
            term in sel.split() and len(sel.split()) > 1 and score <= sel_score * 2.0
            for sel, sel_score in selected
        ):
            continue
        selected.append((term, score))

    top = selected[0][1] if selected else 1.0
    out: list[dict] = []
    seen: set[str] = set()
    for term, score in selected:
        is_skill = term in alias_to_name
        label = alias_to_name[term] if is_skill else _display(term, p)
        if label.lower() in seen:
            continue
        seen.add(label.lower())
        out.append({"keyword": label, "term": term, "score": round(score / top, 3), "is_skill": is_skill})
    return out


def frequency_table(p: ProcessedText, top_n: int = 20) -> list[tuple[str, int]]:
    """Plain frequency analysis (used for documentation / debugging)."""
    return Counter(p.lemmas).most_common(top_n)
