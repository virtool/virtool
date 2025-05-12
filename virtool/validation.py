from typing import Annotated, Any, Generic, TypeVar, get_type_hints

from pydantic import BaseModel, ConfigDict, GetCoreSchemaHandler
from pydantic_core import core_schema


class RequestModel(BaseModel):
    """A base model for JSON request bodies.

    Takes field descriptions from attribute docstrings and ensures `Unset` fields are
    omitted from serialization.
    """

    model_config = ConfigDict(
        use_attribute_docstrings=True,
        validate_default=True,
    )

    def model_dump(self, **kwargs):
        """Override model_dump to exclude Unset values by default."""
        return {
            key: value
            for key, value in super().model_dump(**kwargs).items()
            if value is not Unset
        }

    def model_dump_json(self, **kwargs):
        """Override model_dump_json to exclude Unset values by default."""
        return super().model_dump_json(**kwargs)


class UnsetType:
    """Sentinel value representing an unset field."""

    def __bool__(self) -> bool:
        """Return ``False`` to indicate that the value is unset."""
        return False

    def __repr__(self) -> str:
        """Return a string representation of the UnsetType."""
        return "<Unset>"

    @classmethod
    def __get_pydantic_core_schema__(
        cls: type,
        _source_type: type,
        _handler: GetCoreSchemaHandler,
    ) -> core_schema.CoreSchema:
        """Generate schema for UnsetType."""
        return core_schema.is_instance_schema(UnsetType)


Unset = UnsetType()
"""A sentinel value to indicate that a parameter has not been set."""


T = TypeVar("T")


class UnsetAnnotation(Generic[T]):
    """Type that allows distinguishing between `Unset` and explicit `None`."""

    @classmethod
    def __get_pydantic_core_schema__(
        cls: type, _source_type: Any, _handler: GetCoreSchemaHandler
    ) -> core_schema.CoreSchema:
        """Generate a schema that allows either T or UnsetType."""
        # Get the inner type
        inner_type = get_type_hints(_source_type)["__orig_bases__"][0].__args__[0]
        inner_schema = _handler.generate_schema(inner_type)

        # Create a schema that accepts either the inner type or UnsetType
        return core_schema.union_schema(
            [inner_schema, core_schema.is_instance_schema(UnsetType)]
        )


# Type annotation for fields that can be unset
MaybeUnset = Annotated[T, UnsetAnnotation[T]]


def is_set(value: object) -> bool:
    """Return ``True`` if the value is not ``Unset``."""
    return value is not Unset
