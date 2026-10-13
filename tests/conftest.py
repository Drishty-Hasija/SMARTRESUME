import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

# Isolated database + upload folder for the whole test run (set BEFORE importing the app).
_tmp = tempfile.mkdtemp(prefix="smartresume_test_")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["UPLOAD_DIR"] = f"{_tmp}/uploads"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

DATA = ROOT / "data"


@pytest.fixture(scope="session")
def client():
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def resume_txt() -> str:
    return (DATA / "sample_resume.txt").read_text(encoding="utf-8")


@pytest.fixture(scope="session")
def job_txt() -> str:
    return (DATA / "sample_job_description.txt").read_text(encoding="utf-8")


@pytest.fixture(scope="session")
def resume_pdf() -> bytes:
    return (DATA / "sample_resume.pdf").read_bytes()


@pytest.fixture(scope="session")
def resume_docx() -> bytes:
    return (DATA / "sample_resume.docx").read_bytes()
