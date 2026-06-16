"""Custom exception types shared across the application.

Using domain-specific exceptions lets the API layer translate failures into
clean HTTP responses without leaking library internals.
"""

from __future__ import annotations


class ResumeScreeningError(Exception):
    """Base class for all application-level errors."""


class PDFExtractionError(ResumeScreeningError):
    """Raised when a PDF cannot be read or yields no usable text."""


class EmptyTextError(ResumeScreeningError):
    """Raised when required text (résumé or JD) is missing or blank."""


class LLMError(ResumeScreeningError):
    """Raised when the AI suggestions provider is unavailable or fails."""
