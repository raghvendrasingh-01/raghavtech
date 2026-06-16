"""PDF text-extraction utilities.

Wraps :mod:`pdfminer.six` to turn an uploaded PDF (raw bytes) into clean,
normalised plain text. The functions here are deliberately framework-agnostic:
they accept ``bytes`` rather than a FastAPI ``UploadFile`` so they can be unit
tested in isolation.
"""

from __future__ import annotations

import io
import logging
import re

from pdfminer.high_level import extract_text
from pdfminer.pdfparser import PDFSyntaxError

from app.config import get_settings
from app.exceptions import PDFExtractionError

logger = logging.getLogger(__name__)

# The standard PDF file signature ("%PDF-") at the start of the file. Used as a
# cheap sanity check before handing bytes to the (heavier) parser.
_PDF_MAGIC = b"%PDF-"


def _normalise_whitespace(text: str) -> str:
    """Collapse noisy PDF whitespace into clean, readable text.

    pdfminer often emits ragged spacing, stray form-feeds, and many blank
    lines. We collapse runs of spaces/tabs, trim each line, and limit blank
    lines so downstream NLP gets tidy input.
    """
    # Drop form-feed page separators and carriage returns.
    text = text.replace("\f", "\n").replace("\r", "\n")
    # Collapse runs of spaces/tabs to a single space.
    text = re.sub(r"[ \t]+", " ", text)
    # Trim trailing/leading spaces on each line.
    lines = [line.strip() for line in text.split("\n")]
    text = "\n".join(lines)
    # Collapse 3+ newlines down to a paragraph break.
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def looks_like_pdf(data: bytes) -> bool:
    """Return ``True`` if ``data`` begins with the PDF magic signature.

    The signature may be preceded by a few junk bytes in rare real-world files,
    so we scan the first 1KB rather than requiring it at offset 0.
    """
    return _PDF_MAGIC in data[:1024]


def extract_text_from_pdf_bytes(data: bytes) -> str:
    """Extract normalised plain text from in-memory PDF bytes.

    Args:
        data: The raw bytes of an uploaded PDF file.

    Returns:
        The extracted, whitespace-normalised text.

    Raises:
        PDFExtractionError: If the bytes are empty, are not a PDF, cannot be
            parsed, or contain no extractable text (e.g. a scanned/image-only
            PDF with no text layer).
    """
    if not data:
        raise PDFExtractionError("Uploaded file is empty.")

    if not looks_like_pdf(data):
        raise PDFExtractionError(
            "Uploaded file does not appear to be a valid PDF."
        )

    try:
        raw_text = extract_text(io.BytesIO(data))
    except PDFSyntaxError as exc:  # malformed / corrupt PDF structure
        # Log the underlying detail server-side; return a generic message so we
        # don't leak library/stack internals to the client.
        logger.warning("PDF parse error: %s", exc)
        raise PDFExtractionError(
            "Could not parse the PDF. The file may be corrupt or malformed."
        ) from exc
    except Exception as exc:  # pdfminer can raise a variety of low-level errors
        logger.warning("Unexpected PDF read error: %s", exc)
        raise PDFExtractionError(
            "Could not read the PDF file."
        ) from exc

    text = _normalise_whitespace(raw_text or "")
    if not text:
        raise PDFExtractionError(
            "No extractable text found in PDF. It may be a scanned image "
            "without a text layer."
        )

    # Cap text length to bound downstream CPU/memory for pathological PDFs.
    max_chars = get_settings().MAX_TEXT_CHARS
    if len(text) > max_chars:
        logger.info("Truncating extracted text from %d to %d chars", len(text), max_chars)
        text = text[:max_chars]
    return text
