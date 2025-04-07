from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, GetCoreSchemaHandler
from pydantic_core import core_schema
from pydantic_core.core_schema import PlainValidatorFunctionSchema

T = TypeVar("T")


class RequestModel(BaseModel):
    """A base model for JSON request bodies.

    Takes field descriptions from attribute docstrings and ensures `Unset` fields are
    omitted from serialization.
    """

    model_config = ConfigDict(
        use_attribute_docstrings=True,
    )

    def model_dump(self, *args, **kwargs):
        return {
            key: value
            for key, value in super().model_dump(*args, **kwargs).items()
            if value is not Unset
        }


class UnsetType:
    """Sentinel value representing an unset field."""

    def __bool__(self) -> bool:
        return False  # Treat as falsy in conditions

    def __repr__(self) -> str:
        return "<Unset>"

    @classmethod
    def __get_pydantic_core_schema__(
        cls,
        source_type: Any,
        handler: GetCoreSchemaHandler,
    ) -> PlainValidatorFunctionSchema:
        schema = handler.generate_schema(UnsetType)
        return core_schema.no_info_plain_validator_function(schema)


Unset = UnsetType()
"""A sentinel value to indicate that a parameter has not been set."""


class MaybeUnset(Generic[T]):
    """Type that allows distinguishing between `Unset` and explicit `None`."""

    def __init__(self, value: T | UnsetType = Unset):
        self.value = value

    def __repr__(self) -> str:
        return f"MaybeUnset({self.value!r})"

    def __bool__(self) -> bool:
        return self.value is not Unset

    def __eq__(self, other):
        if isinstance(other, MaybeUnset):
            return self.value == other.value

        return self.value == other


def is_set(value: object) -> bool:
    """Return ``True`` if the value is not ``Unset``."""
    return value is not Unset
