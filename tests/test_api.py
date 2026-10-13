import io


def upload(client, name, content, mime="application/octet-stream"):
    return client.post("/api/resumes/upload", files={"file": (name, io.BytesIO(content), mime)})


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_empty_state_dashboard(client):
    r = client.get("/api/dashboard")
    assert r.status_code == 200
    body = r.json()
    assert body["totals"]["resumes"] == 0 and body["latest_analysis"] is None


def test_upload_pdf_runs_real_analysis(client, resume_pdf):
    r = upload(client, "aarav_resume.pdf", resume_pdf)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "complete" and body["file_type"] == "pdf"
    assert body["analysis"]["score"] > 50
    assert body["analysis"]["skills"]["total"] > 10
    assert "Aarav" in body["raw_text"]


def test_upload_docx_and_txt(client, resume_docx, resume_txt):
    assert upload(client, "a.docx", resume_docx).status_code == 201
    assert upload(client, "a.txt", resume_txt.encode()).status_code == 201


def test_invalid_uploads_return_friendly_errors(client):
    r = upload(client, "photo.png", b"\x89PNG" + b"0" * 200)
    assert r.status_code == 415
    assert r.json()["error"]["code"] == "unsupported_file_type"
    assert "Traceback" not in r.text

    r = upload(client, "empty.txt", b"")
    assert r.status_code == 422

    r = upload(client, "short.txt", b"hi there")
    assert r.status_code == 422 and r.json()["error"]["code"] == "insufficient_text"

    r = upload(client, "fake.pdf", b"not really a pdf" * 30)
    assert r.status_code == 422 and r.json()["error"]["code"] == "extraction_failed"

    r = client.post("/api/resumes/upload")
    assert r.status_code == 422 and r.json()["error"]["code"] == "invalid_request"


def test_oversize_upload(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "max_upload_mb", 1)
    r = upload(client, "big.txt", b"word " * 400_000)
    assert r.status_code == 413 and r.json()["error"]["code"] == "file_too_large"


def test_failed_uploads_are_not_stored(client):
    before = len(client.get("/api/resumes").json())
    upload(client, "bad.pdf", b"nope" * 50)
    assert len(client.get("/api/resumes").json()) == before


def test_list_get_reanalyze(client):
    items = client.get("/api/resumes").json()
    assert len(items) >= 3
    rid = items[0]["id"]
    detail = client.get(f"/api/resumes/{rid}").json()
    assert detail["analysis_count"] == 1
    again = client.post(f"/api/resumes/{rid}/analyze").json()
    assert again["analysis_count"] == 2 and again["analysis"]["score"] == detail["analysis"]["score"]
    assert client.get("/api/resumes/99999").status_code == 404


def test_job_validation(client, job_txt):
    assert client.post("/api/jobs", json={"description": "   "}).status_code == 422
    r = client.post("/api/jobs", json={"description": "too short"})
    assert r.status_code == 422
    assert client.post("/api/jobs", json={}).status_code == 422
    r = client.post("/api/jobs", json={"description": "x " * 20000})
    assert r.status_code == 413


def test_job_from_text_and_file_then_match(client, job_txt):
    job = client.post("/api/jobs", json={"title": "Junior Full Stack", "description": job_txt})
    assert job.status_code == 201
    jb = job.json()
    assert jb["analysis"]["stats"]["required_skills"] > 3

    up = client.post("/api/jobs/upload", files={"file": ("jd.txt", io.BytesIO(job_txt.encode()), "text/plain")})
    assert up.status_code == 201 and up.json()["source_filename"] == "jd.txt"
    assert len(client.get("/api/jobs").json()) == 2
    assert client.get(f"/api/jobs/{jb['id']}").json()["title"] == "Junior Full Stack"

    rid = client.get("/api/resumes").json()[0]["id"]
    m = client.post("/api/match", json={"resume_id": rid, "job_id": jb["id"]})
    assert m.status_code == 201, m.text
    body = m.json()
    assert 0 < body["match_score"] < 100
    assert "Docker" in {s["name"] for s in body["missing_skills"]}
    assert body["details"]["disclaimer"]
    fetched = client.get(f"/api/match/{body['id']}").json()
    assert fetched["match_score"] == body["match_score"]
    assert client.get(f"/api/match?resume_id={rid}").json()[0]["id"] == body["id"]


def test_match_validation_and_not_found(client):
    assert client.post("/api/match", json={"resume_id": 0, "job_id": 1}).status_code == 422
    assert client.post("/api/match", json={"resume_id": 9999, "job_id": 9999}).status_code == 404
    assert client.get("/api/match/9999").status_code == 404


def test_dashboard_numbers_come_from_database(client):
    body = client.get("/api/dashboard").json()
    assert body["totals"]["resumes"] >= 3 and body["totals"]["matches"] >= 1
    assert body["latest_analysis"]["score"] > 0
    assert body["top_skills"] and body["skill_categories"]
    assert body["latest_match"]["match_score"] > 0


def test_history_search_filter_sort(client):
    all_ = client.get("/api/history").json()
    assert all_["total"] == len(all_["items"]) >= 3
    pdf = client.get("/api/history?file_type=pdf").json()
    assert pdf["total"] >= 1 and all(i["file_type"] == "pdf" for i in pdf["items"])
    assert client.get("/api/history?q=aarav_resume").json()["total"] == 1
    assert client.get("/api/history?q=zzzz-none").json()["total"] == 0
    matched = client.get("/api/history?has_match=true").json()
    assert matched["total"] >= 1 and all(i["match_score"] is not None for i in matched["items"])
    by_name = [i["filename"].lower() for i in client.get("/api/history?sort=name&order=asc").json()["items"]]
    assert by_name == sorted(by_name)
    assert client.get("/api/history?sort=bogus").status_code == 422


def test_settings_user(client):
    assert client.get("/api/user").json()["name"]
    ok = client.put("/api/user", json={"name": "Aarav", "email": "Aarav@Example.com"})
    assert ok.status_code == 200 and ok.json()["email"] == "aarav@example.com"
    assert client.put("/api/user", json={"name": "A", "email": "not-an-email"}).status_code == 422


def test_skills_dictionary_endpoint(client):
    body = client.get("/api/skills").json()
    assert body["total_skills"] > 100 and "Programming" in body["skills_by_category"]


def test_load_samples(client):
    r = client.post("/api/samples/load")
    assert r.status_code == 201 and {"resume_id", "job_id"} <= set(r.json())


def test_delete_resume_cascades(client):
    rid = client.get("/api/resumes").json()[-1]["id"]
    assert client.delete(f"/api/resumes/{rid}").status_code == 204
    assert client.get(f"/api/resumes/{rid}").status_code == 404


def test_unknown_route_is_friendly(client):
    r = client.get("/api/nope")
    assert r.status_code == 404 and "error" in r.json()
