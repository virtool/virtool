from typing import Any

from pydantic import BaseModel, ConfigDict, GetCoreSchemaHandler
from pydantic_core import CoreSchema
from pydantic_core.core_schema import (
    no_info_after_validator_function,
)


class RequestModel(BaseModel):
    """A base model for JSON request bodies.

    Takes field descriptions from attribute docstrings.
    """

    model_config = ConfigDict(
        use_attribute_docstrings=True,
    )


class UnsetType:
    """A class to represent a parameter that has not been set."""

    def __repr__(self) -> str:
        """Return a string representation of the class."""
        return "NotSet"

    def __bool__(self) -> bool:
        """Return ``False`` when the class is evaluated as a boolean."""
        return False

    @classmethod
    def __get_pydantic_core_schema__(
        cls,
        _: Any,
        handler: GetCoreSchemaHandler,
    ) -> CoreSchema:
        return no_info_after_validator_function(cls, handler(str))


Unset = UnsetType()
"""A sentinel value to indicate that a parameter has not been set."""


def is_set(value: object) -> bool:
    """Return ``True`` if the value is not ``Unset``."""
    return value is not Unset
