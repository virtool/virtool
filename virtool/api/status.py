"""API status codes."""

from enum import Enum
from typing import Any, Protocol, TypeVar, runtime_checkable


class StatusCode(Enum):
    """The status codes used by the Virtool API."""

    OK = 200
    CREATED = 201
    ACCEPTED = 202
    NO_CONTENT = 204

    FOUND = 302
    NOT_MODIFIED = 304

    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    FORBIDDEN = 403
    NOT_FOUND = 404
    CONFLICT = 409
    UNPROCESSABLE_ENTITY = 422

    BAD_GATEWAY = 502


RespContents_co = TypeVar("RespContents_co", covariant=True)


@runtime_checkable
class R200(Protocol[RespContents_co]):
    """The 200 status code response type."""


@runtime_checkable
class R201(Protocol[RespContents_co]):
    """The 201 status code response type."""


@runtime_checkable
class R202(Protocol[RespContents_co]):
    """The 202 status code response type."""


@runtime_checkable
class R204(Protocol[RespContents_co]):
    """The 204 status code response type."""


@runtime_checkable
class R302(Protocol[RespContents_co]):
    """The 302 status code response type."""


@runtime_checkable
class R304(Protocol[RespContents_co]):
    """The 304 status code response type."""


@runtime_checkable
class R400(Protocol[RespContents_co]):
    """The 400 status code response type."""


@runtime_checkable
class R401(Protocol[RespContents_co]):
    """The 401 status code response type."""


@runtime_checkable
class R403(Protocol[RespContents_co]):
    """The 403 status code response type."""


@runtime_checkable
class R404(Protocol[RespContents_co]):
    """The 404 status code response type."""


@runtime_checkable
class R409(Protocol[RespContents_co]):
    """The 409 status code response type."""


@runtime_checkable
class R422(Protocol[RespContents_co]):
    """The 422 status code response type."""


@runtime_checkable
class R502(Protocol[RespContents_co]):
    """The 502 status code response type."""


def is_status_coded(obj: Any) -> bool:
    """Return True if obj is a status code response type else False."""
    return obj in (
        R200,
        R201,
        R202,
        R204,
        R302,
        R304,
        R400,
        R401,
        R403,
        R404,
        R409,
        R422,
        R502,
    )


__all__ = [
    "StatusCode",
    "R200",
    "R201",
    "R202",
    "R204",
    "R304",
    "R400",
    "R401",
    "R403",
    "R404",
    "R409",
    "R422",
    "R502",
]
