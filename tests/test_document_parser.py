import io

import pytest

from app.services.document_parser import extract_text, safe_filename
from app.utils.errors import AppError, ExtractionFailed, FileTooLarge, InsufficientText, UnsupportedFileType


def test_pdf_extraction(resume_pdf):
    doc = extract_text("resume.pdf", resume_pdf)
    assert doc.file_type == "pdf"
    assert "Aarav Sharma" in doc.text and "Python" in doc.text


def test_docx_extraction(resume_docx):
    doc = extract_text("resume.docx", resume_docx)
    assert doc.file_type == "docx"
    assert "Delhi Technological University" in doc.text
    assert "- Developed 6 REST APIs" in doc.text  # list paragraphs become bullets


def test_txt_extraction_with_latin1_fallback():
    text = ("Résumé of a candidate. " * 10).encode("cp1252")
    doc = extract_text("cv.txt", text)
    assert "Résumé" in doc.text


def test_unsupported_type_rejected():
    with pytest.raises(UnsupportedFileType) as e:
        extract_text("photo.png", b"\x89PNG....")
    assert e.value.status_code == 415


def test_empty_file_rejected():
    with pytest.raises(ExtractionFailed):
        extract_text("resume.txt", b"")


def test_too_little_text_rejected():
    with pytest.raises(InsufficientText):
        extract_text("resume.txt", b"just a few words")


def test_fake_pdf_rejected():
    with pytest.raises(ExtractionFailed):
        extract_text("resume.pdf", b"this is not a pdf at all " * 20)


def test_corrupted_pdf_rejected():
    with pytest.raises(AppError):
        extract_text("resume.pdf", b"%PDF-1.4\n" + b"garbage" * 100)


def test_corrupted_docx_rejected():
    with pytest.raises(AppError):
        extract_text("resume.docx", b"PK\x03\x04" + b"garbage" * 100)


def test_binary_txt_rejected():
    with pytest.raises(ExtractionFailed):
        extract_text("resume.txt", b"abc\x00\x01\x02" * 100)


def test_oversize_rejected(monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "max_upload_mb", 1)
    with pytest.raises(FileTooLarge):
        extract_text("resume.txt", b"a " * (1024 * 1024))


def test_filename_sanitised():
    assert safe_filename("../../etc/passwd") == "passwd"
    assert safe_filename("C:\\Users\\me\\my resume.pdf") == "my resume.pdf"
    assert "<" not in safe_filename("<script>.pdf")
