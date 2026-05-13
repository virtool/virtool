from pydantic import BaseModel


class BaseCacheParams(BaseModel):
    """Base shape for the parameter payload of a cache entry.

    The cache module enforces no fields of its own; callers subclass this
    type to declare the keys that contribute to their cache key. ``extra``
    is forbidden so a typo in a caller's subclass surfaces as a validation
    error rather than a silent cache miss.
    """

    class Config:
        extra = "forbid"
        allow_mutation = False
