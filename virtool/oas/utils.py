from enum import Enum

from pydantic import BaseModel


class HandlerParameterContext(Enum):
    """The context for a handler parameter.

    The context determines where a parameter is parsed from and injected to.
    """

    BODY = "body"
    """The request body."""

    HEADERS = "headers"
    """The request headers."""

    PATH = "path"
    """The portion of the URL path exposed to the handler."""

    QUERY = "query"
    """The URL query string."""


def is_pydantic_base_model(cls: type) -> bool:
    """Return true is obj is a pydantic.BaseModel subclass."""
    return robust_issubclass(cls, BaseModel)


def robust_issubclass(cls_1: type, cls_2: type) -> bool:
    """Check if cls_1 is a subclass of cls_2.

    If either cls_1 or cls_2 is not a class, return False instead of raising a
    TypeError.

    :param cls_1: the class to check
    :param cls_2: the class to check against
    :return: True if cls_1 is a subclass of cls_2, False otherwise
    """
    try:
        return issubclass(cls_1, cls_2)
    except TypeError:
        return False
