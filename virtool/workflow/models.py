from pydantic import validator
from semver import VersionInfo

from virtool.caches.types import BaseCacheParams
from virtool.jobs.models import Workflow


class WorkflowCacheParams(BaseCacheParams):
    """Cache params shared by every workflow-produced cache entry.

    Workflows subclass this to add the input fields that uniquely identify
    their step's output.

    ``use_enum_values`` keeps ``workflow_name`` as a string in the cache key
    digest rather than an enum member.
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
