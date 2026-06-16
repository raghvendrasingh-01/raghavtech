"""Shared pytest fixtures.

Provides a helper to synthesise a minimal, valid single-page PDF containing
arbitrary text lines — so tests don't depend on binary fixture files checked
into the repo.
"""

from __future__ import annotations

import pytest


def make_pdf(lines: list[str]) -> bytes:
    """Build a minimal valid one-page PDF embedding ``lines`` as text.

    This hand-assembles a tiny PDF (catalog → pages → page → content stream →
    font) with a correct xref table, which pdfminer can parse.
    """
    y = 750
    drawn = []
    for line in lines:
        # Escape PDF string special characters.
        safe = line.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
        drawn.append(f"BT /F1 12 Tf 50 {y} Td ({safe}) Tj ET")
        y -= 20
    content = ("\n".join(drawn)).encode()

    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    pdf = b"%PDF-1.4\n"
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(pdf))
        pdf += b"%d 0 obj\n" % i + body + b"\nendobj\n"
    xref_pos = len(pdf)
    pdf += b"xref\n0 %d\n" % (len(objs) + 1)
    pdf += b"0000000000 65535 f \n"
    for off in offsets:
        pdf += b"%010d 00000 n \n" % off
    pdf += (
        b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF"
        % (len(objs) + 1, xref_pos)
    )
    return pdf


@pytest.fixture
def sample_resume_pdf() -> bytes:
    """A valid PDF résumé with a known set of skills."""
    return make_pdf(
        [
            "Jane Doe - Senior Python Engineer",
            "Built REST APIs with FastAPI and Flask.",
            "Skills: Docker, PostgreSQL, AWS, Git, CI/CD, PyTorch.",
            "Frontend: React and TypeScript.",
        ]
    )


@pytest.fixture
def sample_jd() -> str:
    """A job description requiring some skills the résumé lacks."""
    return (
        "We need a Python backend engineer experienced with FastAPI, Docker, "
        "Kubernetes, PostgreSQL, AWS, GraphQL and Kafka. React and TypeScript "
        "are a plus."
    )
