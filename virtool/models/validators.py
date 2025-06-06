import re
from typing import Any

from pydantic import validator


def normalize_hex_color(color: str) -> str:
    """
    Validate a hex color and convert all alpha characters to uppercase.

    :param color: the hex color to validate

    """
    color = color.upper()

    if not re.search(r"^#(?:[\dA-F]{3}){1,2}$", color):
        raise ValueError("The format of the color code is invalid")

    return color


def check_optional_field(value: Any) -> Any:
    """
    Validate an optional value to check if it is being set to null when
    it is not nullable.

    :param value: the optional value to validate

    """
    if value is None:
        raise ValueError("Value may not be null")

    return value


def prevent_none(*args, **kwargs):
    decorator = validator(*args, **kwargs, allow_reuse=True)
    decorated = decorator(check_optional_field)
    return decorated
