# SmartResume

**NLP-based resume analysis and job-description matching.**
*Your resume, understood as data.*

SmartResume lets a user upload a resume (PDF, DOCX or TXT), analyses it with classical NLP, scores it with a transparent formula, and compares it with a job description to show matching skills, missing skills and concrete suggestions. Everything runs locally: no external AI service, no generative AI, no paid API.

> **What it is not.** The *Resume Analysis Score* is not an ATS score, and the *Job Match* is an automated text comparison, not a prediction of hiring outcomes. The app says so wherever it shows these numbers.

---

## Table of contents

1. [Project overview](#1-project-overview)
2. [Problem statement](#2-problem-statement)
3. [Objectives](#3-objectives)
4. [Features](#4-features)
5. [Technology stack](#5-technology-stack)
6. [System architecture](#6-system-architecture)
7. [NLP techniques used](#7-nlp-techniques-used)
8. [Algorithms](#8-algorithms)
9. [Database design](#9-database-design)
10. [API documentation](#10-api-documentation)
11. [Installation](#11-installation)
12. [Running the backend](#12-running-the-backend)
13. [Running the frontend](#13-running-the-frontend)
14. [Sample usage](#14-sample-usage)
15. [Testing](#15-testing)
16. [Limitations](#16-limitations)
17. [Future scope](#17-future-scope)
18. [Deviations from the original specification](#18-deviations-from-the-original-specification)
19. [Project structure](#19-project-structure)

---

## 1. Project overview

SmartResume is a full-stack project with three parts:

| Part | What it does |
|---|---|
| **Frontend** (React + Vite + Tailwind) | Landing page, dashboard, drag-and-drop upload, analysis report, job matching, history, settings. |
| **Backend** (FastAPI + SQLAlchemy + SQLite) | REST API, file validation, text extraction, persistence. |
| **NLP engine** (NLTK, spaCy, scikit-learn) | Preprocessing, section/skill/entity/keyword extraction, scoring, TF-IDF + cosine matching, suggestions. |

The UI follows the `design.md` design system: a restrained neutral palette, Inter + IBM Plex Mono, thin borders instead of shadows, and a data-first, explainable layout.

## 2. Problem statement

Students and early-career candidates often send the same resume to every opening without knowing:

- how their resume reads to a machine (which skills and sections are actually detectable),
- which skills a specific job description asks for that their resume never mentions,
- what to change first.

Commercial tools that answer these questions are usually closed, paid, or opaque about how they score. SmartResume solves the same problem with open, explainable, locally-run NLP, so a student can see *why* a number is what it is.

## 3. Objectives

1. Extract clean text from PDF, DOCX and TXT resumes and handle bad files gracefully.
2. Detect sections, skills, entities and keywords with real NLP techniques.
3. Produce a **transparent** resume score whose formula is documented and unit-tested.
4. Compare a resume with a job description using **TF-IDF + cosine similarity** plus skill and keyword overlap.
5. Generate suggestions dynamically from the actual findings (never a fixed list).
6. Persist everything (SQLite) and expose a browsable history.
7. Ship a polished, responsive, accessible UI that non-technical users can read.

## 4. Features

**Resume analysis**
- Upload with real progress, drag-and-drop, client and server validation (type, size, file signature).
- Text extraction (pypdf, python-docx) with specific errors for empty, encrypted, corrupted, scanned/too-short and oversized files.
- Section detection: contact, summary/objective, education, skills, experience, projects, certifications, achievements, languages.
- Skill extraction from an editable dictionary (131 skills, 10 categories), grouped by category with counts.
- Entity extraction (name, education, organisations, locations, dates, experience length) turned into plain facts.
- Top keywords via TF-IDF.
- **Resume Analysis Score** (0–100) with a per-component breakdown and an explanation for each component.
- Prioritised suggestions (high / medium / low).

**Job matching**
- Paste a job description, upload one (PDF/DOCX/TXT), or reuse a saved one.
- Required vs. nice-to-have skills are told apart (from headings such as "Requirements" / "Nice to have" and phrases such as "a plus").
- Overall match with three separately-reported components: skill match, text similarity (TF-IDF cosine), keyword overlap.
- Matching skills, missing skills (flagged required / nice-to-have), matching and missing keywords, an experience-requirement check, and next-step suggestions.

**Product**
- Dashboard whose numbers all come from the database.
- History with search, filters (type, status, has-match), sorting, and a detail page per analysis (including every job match for that resume).
- Settings, sample data loader, loading / empty / error states on every page.

## 5. Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS 3, React Router 6, Lucide React icons, Recharts |
| Backend | Python 3.10+ (developed on 3.12), FastAPI, Uvicorn, Pydantic v2, pydantic-settings |
| NLP | NLTK (tokenizer, stop-words, POS tagger, WordNet lemmatizer), spaCy `en_core_web_sm`, scikit-learn (TF-IDF, cosine) |
| Documents | pypdf, python-docx |
| Database | SQLite via SQLAlchemy 2.0 |
| Tests | pytest + FastAPI TestClient (backend), Vitest + Testing Library + jsdom (frontend) |

Versions this was developed and tested with: FastAPI 0.142, Pydantic 2.13, SQLAlchemy 2.1, spaCy 3.8, scikit-learn 1.8, NLTK 3.10, pypdf 5.9, python-docx 1.2, Node 22.

Total download is modest: the spaCy small model is about 12 MB; there are no large models.

## 6. System architecture

```text
                    SMARTRESUME
                         |
          ┌──────────────┴──────────────┐
          |                             |
      FRONTEND                       BACKEND
   React + Vite                      FastAPI
          |                             |
          |                    ┌────────┴─────────┐
          |                    |                  |
          |                NLP ENGINE        DATABASE
          |                    |               SQLite
          |          ┌─────────┼──────────┐
          |          |         |          |
          |      Extraction  Analysis   Matching
          └──────────┴─────────┴──────────┘
                         |
                      RESULTS
```

Request flow for an upload:

```text
Browser ──multipart──▶ POST /api/resumes/upload
                          │
        api/resumes.py    │  thin route: reads bytes, calls a workflow
                          ▼
        services/workflows.py   (orchestration + persistence)
              │
              ├─▶ document_parser.py   validate → parse → raw text
              ├─▶ storage.py           save original under a random name
              ├─▶ resume_analyzer.py   NLP pipeline → report (dict)
              │      ├─ preprocessing.py       clean, tokenize, POS, stop-words, lemmas
              │      ├─ section_detector.py    headings + contact regexes
              │      ├─ skill_extractor.py     dictionary (data/skills.json)
              │      ├─ entity_extractor.py    spaCy NER + rules
              │      └─ keyword_extractor.py   TF-IDF
              └─▶ SQLAlchemy           Resume + ResumeAnalysis rows
```

Design rules followed: routes contain no processing logic; extraction, NLP, scoring and matching are separate modules; the original text is stored untouched (`resumes.raw_text`) and cleaned text is derived from it each time.

## 7. NLP techniques used

Written so a student can explain each one in a viva.

### Text cleaning (`preprocessing.clean_text`)
Unicode normalisation (NFKC), consistent line endings, bullet glyphs of any kind (including the private-use and control characters that PDFs emit) converted to `- `, whitespace collapsed, page numbers and consecutive duplicate lines dropped, and wrapped bullet lines re-joined. A second view of the text (`nlp_text`) also removes e-mails, URLs and phone numbers, which would otherwise pollute keywords and skill matching. The original is kept separately.

### Tokenization
Text is split into sentences/lines, then each into tokens with NLTK's `RegexpTokenizer` using a pattern that keeps technical terms whole (`C++`, `C#`, `Node.js`, `scikit-learn`, `e-commerce`), which the default word tokenizer would split. Long lines are split into sentences with NLTK's Punkt sentence tokenizer.

### POS tagging
NLTK's averaged-perceptron tagger labels each token (noun, verb, adjective…). It is used to choose the right lemma and, in keyword extraction, to keep noun-like terms and drop verbs (so "developed" is not a keyword but "REST API" can be).

### Stop-word removal
Common English words ("the", "with", "and") are removed with NLTK's list, plus a small *domain* list of words that are generic in resumes/job posts ("experience", "responsible", "strong", month names). Removing them means counts and TF-IDF reflect content words only. A removed word also **breaks the phrase**, so a bigram is never formed across a removed word (for example "API Python" from "APIs using Python").

### Lemmatization
NLTK's WordNet lemmatizer, guided by the POS tag, reduces words to a base form: "building", "built" → "build"; "databases" → "database". Acronyms (`AWS`, `CSS`) and known tech names (`pandas`) are protected, because WordNet would otherwise turn "pandas" into "panda" and "CSS" into "cs".

### Named Entity Recognition (NER)
spaCy's `en_core_web_sm` finds PERSON, ORG, GPE/LOC and DATE spans. Raw NER is noisy on resumes (it often tags "Python" as an organisation), so it runs line by line, skips the Skills and Projects blocks, and filters out skills, job titles, academic fields and degree names. The result is then merged with rule-based extraction (degrees, institutions, CGPA, date ranges such as "Jun 2025 – Aug 2025") and shown as plain facts: name, education, organisations, locations, dates, experience length. If the spaCy model is missing, the app still works and simply skips NER.

### Rule-based skill extraction
Every alias of every skill in `data/skills.json` is compiled into one regular expression, longest alias first, with look-around boundaries that treat letters, digits, `+` and `#` as word characters. That makes "Java" not match inside "JavaScript", "C++" match as a whole, and "React Native" match as one skill rather than "React". Ambiguous words (Excel, Swift, Rust, Oracle) can be marked *case-sensitive* in the JSON.

### TF-IDF for keywords
A single resume has no corpus, so each **line/sentence is treated as a mini-document**. TF-IDF (term frequency × inverse document frequency) then rewards terms that are repeated *and* specific, and down-weights terms spread across every line. Scores are summed over lines, filtered by POS, boosted ×1.5 for recognised skills, and de-duplicated so "machine learning" replaces the separate words "machine" and "learning".

### TF-IDF + cosine similarity for matching
The resume and the job description are turned into TF-IDF vectors (unigrams + bigrams, sublinear term frequency) with scikit-learn. **Cosine similarity** is the cosine of the angle between the two vectors: 1 means identical wording, 0 means no shared terms. It measures wording overlap, not meaning, which is why it is combined with skill and keyword overlap.

## 8. Algorithms

### Resume analysis

```text
Input:  resume file
Output: analysis report

 1. Validate file (extension, size, signature).            document_parser.validate_upload
 2. Extract text (PDF / DOCX / TXT).                       document_parser.extract_text
 3. Reject if too little text.                             document_parser.check_sufficient
 4. Clean text (original kept separately).                 preprocessing.clean_text
 5. Tokenize; POS-tag.                                     preprocessing.preprocess
 6. Remove stop-words.
 7. Lemmatize.
 8. Detect sections and contact details.                   section_detector.detect_sections
 9. Extract skills (dictionary).                           skill_extractor.extract
10. Extract entities (spaCy NER + rules).                  entity_extractor.extract_entities
11. Extract keywords (TF-IDF).                             keyword_extractor.extract_keywords
12. Calculate the Resume Analysis Score.                   resume_analyzer.analyze_resume
13. Generate suggestions from the findings.                resume_analyzer.build_suggestions
14. Store results (resumes + resume_analysis).             workflows.create_resume
15. Return the report.
```

### Resume Analysis Score

The score is a weighted average of seven measurable components (each 0–100). It is implemented in `services/resume_analyzer.py` and covered by tests.

| Component | Weight | How it is calculated |
|---|---:|---|
| Section completeness | 20 | `85 × (core sections found / 4) + 15 × (optional sections found / 3)`. Core = contact, education, skills, *experience or projects*. Optional = summary, certifications, achievements. |
| Skills | 25 | `70 × min(1, E / 10) + 30 × min(1, categories / 3)`, where E = technical skills + 0.5 × soft skills and categories counts technical categories. |
| Keywords | 15 | `60 × min(1, keywords / 15) + 40 × min(1, skill-keywords / 6)`. |
| Experience | 15 | `30` for a section with ≥ 3 lines (15 if shorter) `+ 35 × (bullets starting with an action verb ÷ bullets) + 35 × min(1, (bullets with numbers ÷ bullets) / 0.5)`. |
| Projects | 10 | `40 × min(1, projects / 2) + 30 × min(1, skills in project text / 3) + 15 × action-verb share + 15 × min(1, quantified share / 0.5)`. |
| Contact | 10 | e-mail 50 + phone 30 + a LinkedIn/GitHub/website link 20. |
| Structure | 5 | length (full marks at 150–1000 words) 50 + bullet points (full at 5) 30 + headed sections (full at 3) 20. |

**Fairness rule.** Experience and Projects are either/or. If a resume has a strong projects section (score ≥ 40) and no experience section, Experience is marked *Not applicable* and its weight is shared by the remaining components, and vice versa. A student with no job history is therefore not penalised. "Quantified" ignores years and month names, so a date is not mistaken for a metric.

Score labels: ≥ 80 *Strong foundation*, ≥ 65 *Good, with room to improve*, ≥ 50 *Needs some work*, otherwise *Early draft*.

### Job matching

```text
Input:  stored resume + stored job description
Output: matching report

 1. Load resume text and its stored analysis.
 2. Load job description text.
 3. Preprocess both texts (same pipeline).                 preprocessing.preprocess
 4. Analyse the job: skills (required / nice-to-have),
    keywords, qualifications, experience asked for.        jd_analyzer.analyze_job_description
 5. Build TF-IDF vectors for both documents.               job_matcher.tfidf_cosine
 6. Compute cosine similarity.
 7. Compare skills: matching, missing, extra.
 8. Compare keywords (the job's top non-skill terms).
 9. Blend the components into the overall match.
10. Generate suggestions; store and return the report.
```

**Overall match** = weighted blend of three separately-reported components:

| Component | Weight | Definition |
|---|---:|---|
| Skill match | 0.45 | Share of the job's skills found in the resume. Required skills weigh 1.0, nice-to-have 0.5. |
| Text similarity | 0.30 | TF-IDF cosine similarity, divided by 0.5 and capped at 1. |
| Keyword overlap | 0.25 | Share of the job's top non-skill keywords that appear in the resume (needs ≥ 5 such keywords, otherwise the component is left out and the others are renormalised). |

> **Important, stated plainly.** Raw cosine similarity between a resume and a job post is naturally low (about 0.2 for the sample pair, and about 0.4–0.5 for a very close match). Dividing by 0.5 before blending is a **heuristic calibration**, not a statistical result. That is why the raw value is always shown separately as *Text similarity*, and why the report breaks the blend into its three parts.

## 9. Database design

SQLite, SQLAlchemy 2.0 models in `backend/app/models/entities.py`. Structured analysis data is stored in JSON columns.

```text
users 1───* resumes 1───* resume_analysis
  │            │
  │            └───* job_matches *───1 job_descriptions
  └──────────────────────────────────* (user owns jobs)
```

| Table | Columns |
|---|---|
| **users** | `id`, `name`, `email` (unique), `created_at` |
| **resumes** | `id`, `user_id`→users, `filename`, `file_type`, `file_size`, `stored_path`, `uploaded_at`, `raw_text`, `status` (processing / complete / failed), `error` |
| **resume_analysis** | `id`, `resume_id`→resumes, `score`, `score_label`, `score_breakdown` (JSON), `skills` (JSON), `keywords` (JSON), `sections` (JSON), `entities` (JSON), `suggestions` (JSON), `stats` (JSON), `created_at` |
| **job_descriptions** | `id`, `user_id`→users, `title`, `description`, `source_filename`, `analysis` (JSON), `created_at` |
| **job_matches** | `id`, `resume_id`→resumes, `job_id`→job_descriptions, `match_score`, `matching_skills` (JSON), `missing_skills` (JSON), `matching_keywords` (JSON), `missing_keywords` (JSON), `details` (JSON: components, verdict, suggestions, experience check, disclaimer), `created_at` |

Notes:
- Re-analysing a resume **adds a new `resume_analysis` row**, so earlier results are kept; the latest row is the one shown.
- Deleting a resume cascades to its analyses and matches and removes the stored file.
- Uploaded files are saved under random names (`uuid.ext`); the client's filename is only stored as metadata, after sanitising.

## 10. API documentation

Base URL `http://localhost:8000`. Interactive docs (Swagger UI) are at **`/docs`**, ReDoc at `/redoc`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/resumes/upload` | Upload a resume (`multipart/form-data`, field `file`); extracts, analyses, stores. `201` |
| GET | `/api/resumes` | List resumes with score and latest match |
| GET | `/api/resumes/{id}` | Full detail: text, latest analysis, job matches |
| POST | `/api/resumes/{id}/analyze` | Re-run the analysis (adds a new analysis row) |
| DELETE | `/api/resumes/{id}` | Delete resume, analyses, matches, stored file. `204` |
| POST | `/api/jobs` | Create a job description from text `{title?, description}`. `201` |
| POST | `/api/jobs/upload` | Create from a PDF/DOCX/TXT file (`file`, optional `title`). `201` |
| GET | `/api/jobs` | List job descriptions |
| GET | `/api/jobs/{id}` | Job detail with its analysis |
| DELETE | `/api/jobs/{id}` | Delete. `204` |
| POST | `/api/match` | Compare `{resume_id, job_id}`. `201` |
| GET | `/api/match` | List matches (`?resume_id=`) |
| GET | `/api/match/{id}` | Match detail |
| DELETE | `/api/match/{id}` | Delete. `204` |
| GET | `/api/dashboard` | Totals, latest analysis and match, top skills, recent items |
| GET | `/api/history` | Analyses with `q`, `status`, `file_type`, `has_match`, `sort` (`date`/`score`/`match`/`name`), `order`, `skip`, `limit` |
| GET / PUT | `/api/user` | Read / update the local profile |
| GET | `/api/skills` | The skill dictionary in use (counts + names) |
| POST | `/api/samples/load` | Create the sample resume and sample job description |
| GET | `/api/health` | Liveness check |

### Error format

Every error uses one shape; raw Python errors are never returned:

```json
{ "error": { "code": "unsupported_file_type",
             "message": "Unsupported file type (.exe).",
             "hint": "Upload a PDF, DOCX or TXT file." } }
```

| Status | Codes |
|---|---|
| 413 | `file_too_large`, `job_description_too_long` |
| 415 | `unsupported_file_type` |
| 422 | `extraction_failed`, `insufficient_text`, `empty_job_description`, `invalid_request` (adds a `details` array of `{field, message}`) |
| 404 | `not_found` |
| 500 | `analysis_failed`, `match_failed`, `database_error`, `server_error` |

### Example: match response (abridged, real output for the sample files)

```json
{
  "id": 1, "resume_id": 1, "job_id": 1,
  "job_title": "Junior Full Stack Developer (Machine Learning)",
  "match_score": 56.7,
  "verdict": "Good alignment",
  "matching_skills": [{"name": "Python", "category": "Programming", "importance": "required"}, "..."],
  "missing_skills": [
    {"name": "AWS", "category": "Cloud & DevOps", "importance": "required"},
    {"name": "Docker", "category": "Cloud & DevOps", "importance": "required"},
    {"name": "FastAPI", "category": "Web", "importance": "required"},
    {"name": "Kubernetes", "category": "Cloud & DevOps", "importance": "preferred"}
  ],
  "details": {
    "components": { "skill_match": 78.6, "text_similarity": 20.2, "keyword_overlap": 36.8,
                    "weights": { "skills": 0.45, "text": 0.3, "keywords": 0.25 } },
    "disclaimer": "This is an automated text-based comparison of your resume and the job description. It is not a prediction of hiring outcomes."
  }
}
```

## 11. Installation

**Requirements:** Python 3.10 or newer, Node.js 18 or newer, and an internet connection for the first setup (to download packages, the spaCy model and NLTK data). After that, everything runs offline.

### Backend

```bash
cd backend
python -m venv .venv

# macOS / Linux
source .venv/bin/activate
# Windows (PowerShell)
.venv\Scripts\Activate.ps1
# Windows (cmd)
.venv\Scripts\activate.bat

pip install -r requirements.txt
python -m spacy download en_core_web_sm
cp .env.example .env        # Windows: copy .env.example .env   (optional: defaults work)
```

NLTK corpora (stop-words, WordNet, tokenizer, POS tagger) are **downloaded automatically on the first start** of the backend. To fetch them yourself in advance:

```bash
python -c "import nltk; [nltk.download(p) for p in ['stopwords','wordnet','omw-1.4','punkt_tab','averaged_perceptron_tagger_eng']]"
```

### Frontend

```bash
cd frontend
npm install
```

### Configuration (`backend/.env`)

No secrets are needed. All settings have defaults; see `backend/.env.example`.

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./smartresume.db` | SQLite file location |
| `UPLOAD_DIR` | `./uploads` | Where original uploads are stored |
| `MAX_UPLOAD_MB` | `10` | Upload size limit |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed browser origins |

Frontend (optional, Vite env): `VITE_API_URL` to call a backend on another origin; `VITE_PROXY_TARGET` to point the dev-server proxy somewhere other than `http://localhost:8000`.


## 13. Sample usage

Sample files are in `data/`: `sample_resume.pdf` (also `.docx` and `.txt`) and `sample_job_description.txt`.

**In the app**
1. Open http://localhost:5173 and click **Open app**.
2. On the dashboard (or **Upload**) click **Try with sample data** — this creates the sample resume and job description, runs the real analysis, and opens the report.
3. Review the score breakdown, detected skills, sections, keywords and suggestions.
4. Go to **Job Matching**, open the **Saved jobs** tab, pick the sample job and click **Compare resume with job**.
5. Open **History** to search, filter, sort and re-open results.

For the sample pair you should see about: Resume Analysis Score **98.8** (the sample resume is deliberately complete), Job match **56.7%** *Good alignment*, with Python, React, SQL, Git and 13 other skills matched, and **AWS, Docker, FastAPI** (required) and **CI/CD, Kubernetes, TypeScript** (nice to have) not detected.

**With curl**

```bash
curl -F "file=@data/sample_resume.pdf" http://localhost:8000/api/resumes/upload

curl -X POST http://localhost:8000/api/jobs -H "Content-Type: application/json" \
  -d '{"title":"Junior Developer","description":"We need a developer with Python, React, SQL, Docker and AWS experience and good communication skills."}'

curl -X POST http://localhost:8000/api/match -H "Content-Type: application/json" \
  -d '{"resume_id":1,"job_id":1}'
```

To regenerate the sample PDF/DOCX from the TXT: `python data/generate_samples.py` (needs `reportlab`, included in requirements).

**Extending the skill dictionary.** Edit `data/skills.json` and restart the backend. No code changes. Format: `Category → Skill → [lowercase aliases]`, or `{"aliases": [...], "case_sensitive": true}` for ambiguous words.

## 15. Testing

```bash
# Backend: 55 tests
cd backend
pytest

# Frontend: 24 tests
cd frontend
npm test
```

**Backend** (`tests/`): PDF / DOCX / TXT extraction (including Windows-1252 text), unsupported, empty, fake, corrupted, binary and oversized files, filename sanitisation; preprocessing (bullets, wrapped lines, tech tokens, lemmas, protected acronyms); section detection; skill extraction boundaries and dictionary extensibility; keyword extraction; resume scoring (weighted-average check, student-not-penalised rule, strong vs weak resume, dynamic suggestions); job-description analysis; TF-IDF cosine properties; match reports; and every API endpoint including validation and error shapes. API tests run against an isolated temporary database.

**Frontend** (`frontend/src/test/`): renders every page and drives the main flows (upload validation and progress, empty-description validation, running a match, history search/filter/sort, delete with confirmation, settings field errors, server-down handling). The fixtures in `src/test/fixtures/` are **real responses captured from the running backend**, so the tests catch API-contract drift. To refresh them after changing the API, run `bash scripts/capture_fixtures.sh` (backend virtualenv active).

**Not covered:** visual appearance and responsive layout are not machine-tested. Check them in a browser (see section 16).

## 14. Limitations

Stated plainly so they can be discussed honestly.

- **The score is a heuristic.** Weights and thresholds are design choices, not learned from data or validated against recruiter decisions. A complete resume can score near 100; a high score does not mean the resume will get interviews.
- **Match percentage is a calibrated blend** (see section 8). Cosine similarity captures shared *wording*, not meaning: "built web apps" and "developed websites" share few terms.
- **Skill coverage is limited to the dictionary** (131 skills). Anything not in `skills.json` is not detected as a skill. Matching is by exact term/alias, with no synonym or semantic understanding.
- **Alternatives are not understood.** "Flask *or* FastAPI" counts FastAPI as missing if only Flask is present.
- **Ambiguous words can misfire.** "Excel" at the start of a sentence ("Excel in fast-paced teams") can be read as the Excel skill.
- **NER is imperfect on resumes.** The small spaCy model is trained on news-style text; organisations and locations can be wrong or missed even after filtering.
- **Section detection depends on standard headings** such as "Education" or "Technical Skills". Unusual or purely graphical layouts, multi-column PDFs and tables may be extracted in a scrambled order.
- **Scanned / image-only PDFs** contain no text layer and are rejected with a message (no OCR).
- **English only.**
- **Experience length is estimated** from dated ranges in the Experience section only.
- **Processing steps are partly timed.** After the upload finishes, the "Extracting text… Detecting skills…" checklist advances on a timer while one analysis request runs; the job-match steps are tied to the actual requests.
- **Single local user, no login.** Not designed for multi-user deployment as is.
- **The UI was not checked in a real browser during development.** The build and component tests pass, but spacing and responsive behaviour should be reviewed visually on desktop, tablet and phone widths.
- No dark mode (optional in the design spec).

## 15. Future scope

- OCR for scanned PDFs (e.g. Tesseract).
- Semantic matching with sentence embeddings, shown alongside TF-IDF so it stays explainable.
- Synonym / alias learning and handling of "A or B" requirements.
- A larger or community-maintained skill taxonomy, with auto-suggested new skills from unmatched terms.
- Validation of the score against labelled resumes and calibration of the match blend.
- User accounts and authentication; PostgreSQL for multi-user use.
- Export of the report as PDF; tailored resume rewriting suggestions per bullet.
- Dark mode and full localisation.

## 16. Deviations from the original specification

Where the spec could not be followed exactly, the closest working alternative was used:

| Spec | What was built | Why |
|---|---|---|
| Users table / profile | A single default local user, editable on the Settings page | The spec has no login or auth requirement. |
| Suggested table columns | Extra columns added (`file_size`, `stored_path`, `status`, `error`, `score_label`, `score_breakdown`, `stats`, `source_filename`, `analysis`, `details`) | Needed for validation, safe file handling, explainable scores and caching job analysis. |
| History of "analyses" | History lists **resumes** with their latest analysis and latest job match; earlier runs are kept in `resume_analysis` | Matches the table design (Resume / Date / Score / Job match / Status). |
| TF-IDF keywords | Each line/sentence is a mini-document | A single resume has no corpus to compute IDF against. |
| Job match "overall similarity" | Blend of skill match, rescaled cosine, keyword overlap, each also reported alone | Raw cosine is too low to be meaningful by itself. |
| Language | JavaScript (not TypeScript) | Easier to explain in a viva; the spec allowed either. |
| Optional dark mode | Not implemented | Marked optional in `design.md`. |
| Upload processing steps | Upload progress is real; later steps are timer-advanced while one request runs | The backend exposes a single analysis call, not a streamed status. |
