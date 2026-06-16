"""Tests for the PDF extraction service."""

import pytest

from app.exceptions import PDFExtractionError
from app.services.pdf_service import (
    extract_text_from_pdf_bytes,
    looks_like_pdf,
)


def test_extracts_text_from_valid_pdf(sample_resume_pdf):
    text = extract_text_from_pdf_bytes(sample_resume_pdf)
    assert "Python" in text
    assert "FastAPI" in text


def test_rejects_non_pdf_bytes():
    with pytest.raises(PDFExtractionError):
        extract_text_from_pdf_bytes(b"plain text, not a pdf")


def test_rejects_empty_bytes():
    with pytest.raises(PDFExtractionError):
        extract_text_from_pdf_bytes(b"")


def test_looks_like_pdf(sample_resume_pdf):
    assert looks_like_pdf(sample_resume_pdf) is True
    assert looks_like_pdf(b"nope") is False
