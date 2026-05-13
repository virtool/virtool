from virtool.caches.types import BaseCacheParams


class WorkflowCacheParams(BaseCacheParams):
    """Cache params shared by every workflow-produced cache entry.

    Workflows subclass this to declare the additional keys that contribute
    to their cache key. ``tool_name`` and ``tool_version`` are required
    because every workflow cache is keyed on the tool that produced it.
    """

    tool_name: str
    tool_version: str
