"""
app/utils/exceptions.py — Centralized HTTP error handling

Rules:
- ALWAYS raise errors through AppException. Never raise HTTPException directly.
- This ensures consistent status codes across the entire codebase.
- Grep-friendly: search "AppException.forbidden" to find every access check.

Usage in any service or route:
    from app.utils.exceptions import AppException

    AppException.not_found("Trip not found")
    AppException.forbidden()
    AppException.conflict("You are already a member of this group")
"""
from fastapi import HTTPException, status


class AppException:
    """
    Static factory methods for HTTP errors.
    Each method raises immediately — no need to use `raise` at the call site.
    """

    @staticmethod
    def bad_request(detail: str = "Bad request") -> None:
        """400 — malformed input, failed validation, invalid business rule."""
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )

    @staticmethod
    def unauthorized(detail: str = "Authentication required") -> None:
        """401 — missing or invalid JWT token."""
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )

    @staticmethod
    def forbidden(detail: str = "You do not have permission to perform this action") -> None:
        """403 — authenticated but not allowed (e.g. not a group admin)."""
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )

    @staticmethod
    def not_found(detail: str = "Resource not found") -> None:
        """404 — resource does not exist."""
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )

    @staticmethod
    def conflict(detail: str = "Resource already exists") -> None:
        """409 — duplicate resource (e.g. already a member, already voted)."""
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        )

    @staticmethod
    def unprocessable(detail: str = "Unprocessable request") -> None:
        """422 — input is valid format but cannot be processed (e.g. bad dates)."""
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
        )

    @staticmethod
    def payment_required(detail: str = "This feature requires a Pro subscription") -> None:
        """402 — feature is behind a paywall (Phase 3 feature gates)."""
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=detail,
        )

    @staticmethod
    def bad_gateway(detail: str = "Bad gateway") -> None:
        """502 — upstream service returned an error (e.g. weather provider)."""
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        )

    @staticmethod
    def service_unavailable(detail: str = "Service unavailable") -> None:
        """503 — dependency not configured or temporarily unavailable."""
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        )

    @staticmethod
    def internal(detail: str = "An unexpected error occurred") -> None:
        """500 — something went wrong server-side that should never happen."""
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
        )
