from pydantic import validator
from semver import VersionInfo

from virtool.caches.types import BaseCacheParams
from virtool.jobs.models import Workflow


class WorkflowCacheParams(BaseCacheParams):
    """Cache params shared by every workflow-produced cache entry.

    Workflows subclass this to declare the additional keys that contribute
    to their cache key. ``workflow_name``, ``workflow_version``, and ``step``
    are required so every cache row is namespaced by the workflow, version,
    and step that produced it; without ``step``, two steps of the same
    workflow with coincidentally-overlapping input fields would collide.
    Bumping ``workflow_version`` is the canonical way to invalidate downstream
    cached artifacts when a workflow's semantics change.

    ``workflow_name`` is typed as :class:`virtool.jobs.models.Workflow` so the
    set of valid namespaces is bounded; ``use_enum_values`` ensures the cache
    key digest sees the stable string value rather than the enum member.
    """

    workflow_name: Workflow
    workflow_version: str
    step: str

    class Config:
        use_enum_values = True

    @validator("workflow_version")
    def _workflow_version_is_semver(cls, value: str) -> str:
        try:
            VersionInfo.parse(value.lstrip("v"))
        except ValueError as exc:
            raise ValueError(
                f"workflow_version must be a valid semantic version, got {value!r}",
            ) from exc
        return value
