from pydantic import BaseModel, GetCoreSchemaHandler
from pydantic_core import core_schema


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


def is_set(model_instance: BaseModel, field_name: str) -> bool:
    """Return ``True`` if the value is not ``Unset``."""
    if field_name not in model_instance.model_fields:
        msg = (
            f"Field {field_name} not found in model {model_instance.__class__.__name__}"
        )
        raise ValueError(msg)

    return field_name in model_instance.__pydantic_fields_set__
