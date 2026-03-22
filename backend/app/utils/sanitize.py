"""Input sanitization for free-text medical report fields.

Strips HTML tags, null bytes, and normalizes Unicode to prevent XSS,
injection, and data corruption in downstream consumers (PDF, DICOM SR,
audit logs, AI prompts).
"""

from __future__ import annotations

import re
import unicodedata

# Maximum field lengths
MAX_FINDINGS_LENGTH = 50_000
MAX_IMPRESSION_LENGTH = 20_000
MAX_COMMENT_LENGTH = 5_000

# HTML tag pattern
_HTML_TAG_RE = re.compile(r"<[^>]+>")

# Null bytes and other control characters (except newline, tab, carriage return)
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def sanitize_medical_text(text: str | None, max_length: int = MAX_FINDINGS_LENGTH) -> str | None:
    """Sanitize free-text input for safe storage and processing.

    - Strips HTML tags
    - Removes null bytes and control characters
    - Normalizes Unicode to NFC form
    - Truncates to max_length

    Returns None if input is None (preserves optional semantics).
    """
    if text is None:
        return None

    # Normalize Unicode to NFC (canonical composition)
    text = unicodedata.normalize("NFC", text)

    # Remove null bytes and control characters
    text = _CONTROL_CHAR_RE.sub("", text)

    # Strip HTML tags
    text = _HTML_TAG_RE.sub("", text)

    # Truncate to maximum length
    if len(text) > max_length:
        text = text[:max_length]

    return text
