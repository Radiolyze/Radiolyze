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
