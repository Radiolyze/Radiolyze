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
    """Raised when the request itself is unacceptable to the domain.

    For rules the service enforces rather than the schema — an unsupported
    export format, an empty upload — where the transport layer should report a
    bad request.
    """


class PayloadTooLargeError(DomainError):
    """Raised when a submitted payload exceeds the limit the service accepts.

    A sibling of :class:`ValidationError` rather than a subclass: the transport
    layer answers it with its own status code, and a handler catching the
    broader error must not swallow this one.
    """


class UpstreamError(DomainError):
    """Raised when a dependency the service calls out to fails.

    Distinct from the errors above: nothing is wrong with the request, so the
    transport layer should report it as a bad gateway rather than a client
    error.
    """


class FeatureUnavailableError(DomainError):
    """Raised when this deployment cannot perform an otherwise valid operation.

    The request is well formed and the entity exists; the capability is simply
    absent from the build — an optional dependency that was never installed.
    Distinct from :class:`UpstreamError`, where the capability exists but the
    dependency it reaches for is failing.
    """
