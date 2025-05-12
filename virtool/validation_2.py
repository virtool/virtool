from typing import Any, Self

from pydantic import GetCoreSchemaHandler
from pydantic_core import core_schema


class Unset:
    __instace = None
    __slots__ = []

    def __new__(cls) -> Self:
        if cls.__instace is None:
            cls.__instace = super().__new__(cls)
        return cls.__instace

    def __repr__(self):
        return "Unset"

    def __str__(self) -> str:
        return "Unset"

    def __bool__(self):
        return False

    @classmethod
    def __get_pydantic_core_schema__(
        cls,
        source: type[Any],
        handler: GetCoreSchemaHandler,
    ) -> core_schema.CoreSchema:
        assert source is Unset

        def validate_from_undefined(value):
            if value is not Unset():
                raise ValueError(f"expected Unset, got {value}")

        serialization_schema = core_schema.plain_serializer_function_ser_schema(
            lambda v: Unset()
        )
        instance_validation_schema = core_schema.is_instance_schema(
            Unset, serialization=serialization_schema
        )
        json_validation_schema = core_schema.no_info_plain_validator_function(
            function=validate_from_undefined, serialization=serialization_schema
        )

        return core_schema.json_or_python_schema(
            json_schema=json_validation_schema,
            python_schema=instance_validation_schema,
            serialization=serialization_schema,
        )
