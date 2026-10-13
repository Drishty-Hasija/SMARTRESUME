from app.services.keyword_extractor import extract_keywords
from app.services.preprocessing import clean_text, preprocess, to_nlp_text
from app.services.section_detector import detect_sections, section_report
from app.services.skill_extractor import get_skill_extractor


# ------------------------------------------------------------ preprocessing
def test_clean_text_normalises_bullets_whitespace_and_duplicates():
    raw = "Name\r\n\u2022   Built   APIs\n\x7f Wrote tests\n\n\n\nPage 1 of 2\nName\nName"
    cleaned = clean_text(raw)
    assert "- Built APIs" in cleaned and "- Wrote tests" in cleaned
    assert "Page 1" not in cleaned
    assert "\n\n\n" not in cleaned
    assert cleaned.count("Name") == 2  # only *consecutive* duplicates are removed


def test_clean_text_joins_wrapped_bullet_lines():
    assert "reaching 88% accuracy" in clean_text("- Trained a model reaching 88%\naccuracy\n- Next")


def test_original_text_is_preserved():
    raw = "  Built   REST APIs  "
    assert preprocess(raw).original == raw


def test_contact_details_removed_for_nlp():
    t = to_nlp_text("mail me@x.com or +91 98765 43210 see github.com/me")
    assert "@" not in t and "98765" not in t and "github" not in t


def test_tokenisation_keeps_technical_terms():
    p = preprocess("Experienced in C++, C#, Node.js and scikit-learn.")
    for tok in ("c++", "c#", "node.js", "scikit-learn"):
        assert tok in p.tokens


def test_stopwords_removed_and_lemmatised():
    p = preprocess("The students were building applications with the databases")
    assert "the" not in p.filtered_tokens and "were" not in p.filtered_tokens
    assert "student" in p.lemmas and "build" in p.lemmas and "database" in p.lemmas


def test_acronyms_and_tech_names_not_mangled():
    lemmas = preprocess("We use AWS, CSS and pandas daily").lemmas
    assert "aws" in lemmas and "css" in lemmas and "pandas" in lemmas


# ---------------------------------------------------------------- sections
def test_section_detection_and_report(resume_txt):
    p = preprocess(resume_txt)
    sections = detect_sections(p.cleaned)
    for key in ("education", "skills", "experience", "projects", "certifications"):
        assert sections.has(key), key
    assert sections.has("contact")
    report = {r["key"]: r for r in section_report(sections)}
    assert report["education"]["status"] == "present"


def test_languages_label_inside_skills_does_not_split_section():
    text = "SKILLS\nLanguages: Python, Java\nWeb: React\nEDUCATION\nB.Tech"
    s = detect_sections(text)
    assert "Python" in s.text("skills") and "React" in s.text("skills")
    assert not s.has("languages")


def test_missing_optional_sections_flagged_but_not_errors():
    s = detect_sections("EDUCATION\nB.Tech\nSKILLS\nPython")
    rep = {r["key"]: r for r in section_report(s)}
    assert rep["certifications"]["status"] == "optional_missing"
    assert rep["experience"]["status"] == "missing"


# ------------------------------------------------------------------ skills
def test_skill_extraction_boundaries():
    ex = get_skill_extractor()
    names = ex.extract_names("Java, JavaScript, C++, C#, Node.js, MySQL, SQL, UI/UX, React Native")
    assert {"Java", "JavaScript", "C++", "C#", "Node.js", "MySQL", "SQL", "UI/UX", "React Native"} <= names
    assert "React" not in names  # 'React Native' consumed as one skill
    assert ex.extract_names("I know javascript") == {"JavaScript"}  # not Java as well


def test_skill_categories_and_counts(resume_txt):
    ex = get_skill_extractor()
    hits = ex.extract(resume_txt)
    grouped = ex.group_by_category(hits)
    assert "Programming" in grouped and "Python" in grouped["Programming"]
    assert len(hits) > 20
    assert all(h["count"] >= 1 for h in hits)


def test_skill_dictionary_is_extensible(tmp_path):
    import json

    from app.services.skill_extractor import SkillExtractor

    path = tmp_path / "skills.json"
    path.write_text(json.dumps({"categories": {"Custom": {"Quantum Computing": ["quantum computing", "qc"]}}}))
    assert SkillExtractor(path).extract_names("Studied quantum computing") == {"Quantum Computing"}


# ---------------------------------------------------------------- keywords
def test_keywords_are_meaningful(resume_txt):
    p = preprocess(resume_txt)
    kws = extract_keywords(p, top_n=15)
    labels = [k["keyword"] for k in kws]
    assert 5 <= len(labels) <= 15
    assert "Python" in labels or "React" in labels
    assert not {"the", "and", "with"} & {l.lower() for l in labels}
    assert all(0 <= k["score"] <= 1 for k in kws)
    assert kws == sorted(kws, key=lambda k: -k["score"])


def test_keywords_empty_text():
    assert extract_keywords(preprocess("")) == []
