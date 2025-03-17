"""Exceptions related to OpenAPI specification parsing."""

from collections.abc import Sequence
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from virtool.api.introspect import HandlerParameterGroup


class DocstringParsingError(Exception):
    """An error raised when parsing a docstring."""


class DuplicateParameterNamesError(Exception):
    """Raised when a same parameter name is used in group and function signature."""

    attr_name: str
    """The name of the attribute that is in conflict."""

    group: type["HandlerParameterGroup"]
    """The group that is in conflict."""

    def __init__(self, names: Sequence[str]) -> None:
        joined = ", ".join(names)

        super().__init__(
            f"Found duplicate parameter names: {joined}. Duplicates may originate in "
            "parameter groups",
        )
