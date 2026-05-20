from typing import Any

from pydantic import BaseModel


class BaseCacheParams(BaseModel):
    """Base shape for the parameter payload of a cache entry.

    Not instantiable directly — subclass to declare the fields that
    contribute to the cache key. A bare instance would have no fields and
    every direct instantiation would collide on the same derived key, so the
    base raises on construction to surface the mistake at the call site.

    ``extra`` is forbidden so a typo in a caller's subclass surfaces as a
    validation error rather than a silent cache miss.
    """

    class Config:
        extra = "forbid"
        allow_mutation = False

    def __init__(self, **data: Any) -> None:
        if type(self) is BaseCacheParams:
            raise TypeError(
                "BaseCacheParams is an abstract base; subclass it and "
                "declare the fields that contribute to the cache key.",
            )
        super().__init__(**data)
