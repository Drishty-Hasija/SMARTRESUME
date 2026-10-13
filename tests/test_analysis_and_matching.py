import pytest

from app.services.jd_analyzer import analyze_job_description
from app.services.job_matcher import match_resume_to_job, tfidf_cosine
from app.services.preprocessing import preprocess
from app.services.resume_analyzer import WEIGHTS, analyze_resume, is_quantified


@pytest.fixture(scope="module")
def report(resume_txt):
    return analyze_resume(resume_txt)


def test_report_structure(report):
    assert 0 <= report["score"] <= 100
    assert set(report["score_breakdown"]) == set(WEIGHTS)
    assert report["skills"]["total"] == len(report["skills"]["items"]) > 10
    assert report["entities"]["name"] == "Aarav Sharma"
    assert report["entities"]["education"]["institutions"] == ["Delhi Technological University"]
    assert report["stats"]["word_count"] > 100


def test_score_is_weighted_average_of_components(report):
    bd = report["score_breakdown"]
    active = {k: v for k, v in bd.items() if v["applicable"]}
    expected = sum(v["score"] * v["weight"] for v in active.values()) / sum(v["weight"] for v in active.values())
    assert report["score"] == pytest.approx(expected, abs=0.2)


def test_strong_resume_scores_higher_than_weak(resume_txt):
    weak = analyze_resume("John\nI like computers and want a job. I am a hard worker and good person. " * 3)
    strong = analyze_resume(resume_txt)
    assert strong["score"] > weak["score"] + 30
    assert any(s["priority"] == "high" for s in weak["suggestions"])


def test_student_not_penalised_for_missing_experience():
    text = """Riya Verma
riya@example.com | +91 91234 56789
EDUCATION
B.Tech in Computer Science, Example University, 2022 - 2026
SKILLS
Python, SQL, Git, HTML, CSS, JavaScript
PROJECTS
Expense Tracker
- Built a web app in Python and Flask used by 30 students
- Designed a SQL schema with 6 tables
Weather Dashboard
- Developed a JavaScript dashboard reading 3 public APIs
"""
    r = analyze_resume(text)
    assert r["score_breakdown"]["experience"]["applicable"] is False
    assert r["score_breakdown"]["projects"]["applicable"] is True


def test_suggestions_are_dynamic():
    no_projects = analyze_resume("Sam Lee\nsam@x.com\nEDUCATION\nB.Sc Physics, Some College\nSKILLS\nPython, SQL, Excel, Git, HTML, CSS " * 2)
    texts = " ".join(s["message"] for s in no_projects["suggestions"])
    assert "projects" in texts.lower()
    no_numbers = analyze_resume("Sam Lee\nsam@x.com\nEXPERIENCE\nAcme, Intern\n- Built tools for the team\n- Wrote reports for managers\n- Helped customers daily\nSKILLS\nPython, SQL, Git, HTML, CSS, React")
    assert any("measurable" in s["message"].lower() for s in no_numbers["suggestions"])


def test_quantification_ignores_dates():
    assert is_quantified("Reduced load time by 40%")
    assert not is_quantified("Worked there from Jun 2023 to Aug 2024")


# ---------------------------------------------------------- job description
def test_job_description_analysis(job_txt):
    ja = analyze_job_description(job_txt)
    by_name = {s["name"]: s["importance"] for s in ja["skills"]}
    assert by_name["Python"] == "required" and by_name["Docker"] == "required"
    assert by_name["Kubernetes"] == "preferred" and by_name["TypeScript"] == "preferred"
    assert ja["experience"]["min_years"] == 1
    assert any("bachelor" in q.lower() for q in ja["qualifications"])
    assert ja["keywords"]


# ------------------------------------------------------------------ matching
def test_tfidf_cosine_properties():
    a = preprocess("python flask rest api development").match_document()
    assert tfidf_cosine(a, a) == pytest.approx(1.0)
    assert tfidf_cosine(a, preprocess("watercolour painting landscapes").match_document()) == 0.0
    assert tfidf_cosine("", a) == 0.0
    related = preprocess("python developer building rest api with flask").match_document()
    unrelated = preprocess("marketing manager brand campaigns social media").match_document()
    assert tfidf_cosine(a, related) > tfidf_cosine(a, unrelated)


def test_match_report(resume_txt, job_txt, report):
    m = match_resume_to_job(resume_txt, report["skills"]["items"], job_txt)
    matching = {s["name"] for s in m["matching_skills"]}
    missing = {s["name"] for s in m["missing_skills"]}
    assert {"Python", "React", "SQL", "Git"} <= matching
    assert {"Docker", "AWS", "Kubernetes"} <= missing
    assert matching.isdisjoint(missing)
    assert 0 < m["match_score"] < 100
    assert 0 < m["components"]["text_similarity"] < 100
    assert "not a prediction" in m["disclaimer"]
    assert any("Docker" in s["message"] for s in m["suggestions"])


def test_better_resume_matches_higher(job_txt, resume_txt):
    off_topic = "Maria Gomez\nmaria@x.com\nSKILLS\nCooking, Baking, Painting, Gardening\nEXPERIENCE\n- Managed a bakery team of 6 and increased sales by 20%"
    good = match_resume_to_job(resume_txt, None, job_txt)["match_score"]
    bad = match_resume_to_job(off_topic, None, job_txt)["match_score"]
    assert good > bad + 20
