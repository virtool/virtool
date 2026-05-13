from pydantic import BaseModel


class CacheParams(BaseModel):
    """Base shape for the parameter payload of a cache entry.

    Subclass per use case to declare the keys that contribute to the cache
    key. ``tool_name`` and ``tool_version`` are required on the base because
    every cache entry today is keyed on the tool that produced it.
    """

    tool_name: str
    tool_version: str

    class Config:
        extra = "forbid"
        allow_mutation = False
