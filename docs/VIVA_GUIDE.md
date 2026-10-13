# SmartResume: viva guide

Likely questions and honest answers. Every answer points to the code that backs it up, so you can open the file if asked.

---

## The project in 30 seconds

> SmartResume takes a resume file, extracts its text, and uses classical NLP (tokenization, lemmatization, named-entity recognition, TF-IDF) plus a skill dictionary to detect sections, skills and keywords. It computes a transparent score from seven measurable components. Given a job description, it compares the two documents with TF-IDF and cosine similarity plus skill and keyword overlap, and generates suggestions from the gaps. It runs fully locally: no ChatGPT, no deep learning, no paid API.

---

## NLP questions

**Q1. What NLP techniques did you use, and where?**
Tokenization, POS tagging, stop-word removal and lemmatization (`services/preprocessing.py`, NLTK); named-entity recognition (`entity_extractor.py`, spaCy); TF-IDF (`keyword_extractor.py` and `job_matcher.py`, scikit-learn); cosine similarity (`job_matcher.tfidf_cosine`); rule-based skill extraction (`skill_extractor.py`).

**Q2. Why did you not use NLTK's `word_tokenize`?**
It splits `C++` into `C` + `++` and `Node.js` into pieces. Resumes are full of such terms, so I used NLTK's `RegexpTokenizer` with a pattern that keeps them whole. It is still NLTK, just configured for the domain.

**Q3. Stop-word removal: why add your own list?**
NLTK's list removes grammar words ("the", "with"). Resumes and job posts are also full of words that carry no information ("experience", "responsible", "strong", month names). Those are in `DOMAIN_STOPWORDS`. Without them, "experience" would be a top keyword in every resume.

**Q4. Why lemmatization and not stemming?**
Stemming chops suffixes by rule and produces non-words ("develop" and "developing" → "develop", but "studies" → "studi"). The WordNet lemmatizer returns real words and uses the POS tag, so "built" → "build". I also protect acronyms and tech names, because WordNet would turn "pandas" into "panda" and "CSS" into "cs".

**Q5. TF-IDF needs a corpus. A resume is one document. How does it work?**
I treat each line/sentence as a mini-document. IDF then measures how many *lines* a term appears in. A term repeated in a few specific lines scores high; a term in every line scores low. Scores are summed across lines (`norm=None`, so short lines don't inflate scores), filtered by POS, and boosted for recognised skills. I should be honest that this is an adaptation: it is a reasonable way to rank terms inside one document, not classic corpus-level TF-IDF.

**Q6. Explain cosine similarity.**
Each document becomes a vector (one dimension per term, value = TF-IDF weight). Cosine similarity is the cosine of the angle between the vectors: `(A·B) / (|A||B|)`. 1 = same direction (same wording), 0 = nothing in common. It ignores document length. Limitation: it only sees shared *words*, not meaning.

**Q7. Why is your match score not just the cosine similarity?**
For a real resume and job post, cosine is naturally low (about 0.20 for the sample pair). Reporting "20% match" for a decent fit would mislead. So the overall match blends skill match (45%), rescaled cosine (30%) and keyword overlap (25%). The rescaling (divide by 0.5, cap at 1) is a **heuristic**; I say so in the README and show the raw value separately as "Text similarity".

**Q8. How does NER help, and what are its problems?**
spaCy's small model tags people, organisations, places and dates. On resumes it is noisy: it labels "Python" as an organisation and "Computer Science" as a location. So I run it line by line, skip the Skills/Projects blocks, filter out skills, job titles and academic fields, and combine it with regex rules for degrees, institutions, CGPA and date ranges. The user sees plain facts, not raw NER output.

**Q9. How do you extract skills? Why not machine learning?**
A dictionary (`data/skills.json`) of skills and aliases compiled into one regular expression, longest match first, with boundary rules so "Java" doesn't match in "JavaScript". I chose it because it is deterministic, explainable and easy to extend, which matters for a student project and for a resume tool where users want to know *why* a skill was or wasn't found. The cost is coverage: it only finds skills in the dictionary.

**Q10. How do you tell required skills from nice-to-have ones in a job description?**
By structure: headings such as "Requirements" vs "Nice to have", and phrases such as "a plus", "preferred", "bonus". Required skills weigh 1.0 in the skill match; nice-to-have weigh 0.5 (`jd_analyzer.py`).

---

## Scoring questions

**Q11. How is the resume score calculated? Is it an ATS score?**
No, and the UI says so. It is a weighted average of seven measurable parts: sections 20, skills 25, keywords 15, experience 15, projects 10, contact 10, structure 5 (full formulas in README section 8, code in `resume_analyzer.py`). The breakdown and an explanation per component are shown to the user.

**Q12. Isn't a student without work experience penalised?**
No. Experience and Projects are either/or: if there is a strong projects section and no experience section, Experience is marked "Not applicable" and its weight is redistributed. There is a test for exactly this (`test_student_not_penalised_for_missing_experience`).

**Q13. Why does the sample resume score 98.8? Is the score meaningful?**
The sample resume is deliberately complete, and the formula rewards completeness and evidence (skills, action verbs, numbers). A weak resume scores far lower (a test asserts a gap of more than 30 points). But the weights and thresholds are my design choices, not learned from data or validated against recruiters, so the score measures *how complete and well-evidenced the resume is*, not whether it will succeed.

**Q14. Are the suggestions hard-coded?**
They are rule-based, but generated from the findings: e.g. "None of the 5 experience bullet points include numbers" appears only if that is true, and the missing-skills suggestion names the exact missing skills. Two different resumes produce different suggestion lists (tested).

---

## Engineering questions

**Q15. Why FastAPI, SQLite, React?**
FastAPI gives typed request/response validation and automatic API docs (`/docs`). SQLite needs no server, so the project runs on any laptop; SQLAlchemy keeps the code portable to PostgreSQL. React + Vite gives a fast, componentised UI.

**Q16. How do you handle bad uploads?**
Layered checks: extension whitelist, size limit, file-signature check (a `.pdf` must start with `%PDF`), parser-specific errors (encrypted PDF, corrupt DOCX, binary "text"), and a minimum-text check (catches scanned PDFs). Each returns a specific, human message. Files are stored under random names, so a client filename can never become a path. Tested in `test_document_parser.py` and `test_api.py`.

**Q17. How did you test it?**
55 backend tests (extraction, NLP, scoring, matching, every endpoint) and 24 frontend tests. The frontend tests use **real API responses captured from the running backend** as fixtures, so a change in the API shape breaks a test. Testing found real bugs: Windows-1252 text was being mis-decoded as UTF-16, wrapped PDF lines inflated the project count, and PDF bullet characters were being stripped.

**Q18. Is there any "AI" in it?**
No generative AI or deep learning. spaCy's NER model is a small pre-trained neural model, and I say that. Everything else is classical NLP, rules and linear algebra.

---

## "What are the limitations?" (answer this one confidently)

- The score and the match blend are heuristics, not validated predictions.
- Skills only come from the dictionary; matching is exact-term, with no synonyms or semantics.
- "Flask *or* FastAPI" counts FastAPI as missing; "Excel in teams" can be read as the Excel skill.
- Scanned PDFs (no OCR), multi-column layouts, unusual headings and non-English text are not handled well.
- NER on resumes is imperfect.
- Single local user; no authentication.

## "What would you do next?"

OCR for scanned PDFs; sentence-embedding similarity shown next to TF-IDF; handling of "A or B" requirements; a larger skill taxonomy; validating and calibrating the score and the match blend against labelled data; user accounts and PostgreSQL.
