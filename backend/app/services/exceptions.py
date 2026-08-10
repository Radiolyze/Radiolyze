"""Framework-independent domain exceptions raised by the service layer.

Route handlers catch these and translate them into the appropriate
``HTTPException`` (or other transport-specific response), keeping the
services themselves free of any FastAPI/Starlette dependency.
"""

from __future__ import annotations


class DomainError(Exception):
    """Base class for service-layer domain errors."""


class NotFoundError(DomainError):
    """Raised when a requested domain entity does not exist."""


class ConflictError(DomainError):
    """Raised when an operation conflicts with the entity's current state."""


class ValidationError(DomainError):
    """Raised when the request itself is malformed or out of bounds.

    Carries an optional ``status_code`` hint for the cases where the transport
    layer has a more specific answer than a plain 400 — an oversized upload is
    a 413, not a bad request — so the service can state *what* is wrong without
    importing anything from FastAPI.
    """

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


class UpstreamError(DomainError):
    """Raised when a dependency the service calls out to fails.

    Distinct from the errors above: nothing is wrong with the request, so the
    transport layer should report it as a bad gateway rather than a client
    error.
    """
