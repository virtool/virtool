from datetime import datetime

from virtool.analyses.utils import find_nuvs_sequence_by_index
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
    ResourceNotModifiedError,
)


async def check_if_analysis_modified(
    if_modified_since: datetime | None,
    document: dict,
) -> None:
    """Raise a `ResourceNotModifiedError` if the `if_modified_since` header matches the
    `updated_at` or `created_at` fields of the `document`.

    :param if_modified_since: The `If-Modified-Since` header value
    :param document: The document to check
    """
    if if_modified_since is not None:
        try:
            if if_modified_since == document["updated_at"]:
                raise ResourceNotModifiedError()
        except KeyError:
            if if_modified_since == document["created_at"]:
                raise ResourceNotModifiedError()


async def check_if_analysis_ready(jobs_api_flag: bool, ready: bool) -> None:
    if (jobs_api_flag and ready) or not ready:
        raise ResourceConflictError()


async def check_analysis_workflow(workflow: str) -> None:
    if workflow != "nuvs":
        raise ResourceConflictError("Not a NuVs analysis")


async def check_if_analysis_running(ready: bool) -> None:
    if not ready:
        raise ResourceConflictError("Analysis is still running")


async def check_analysis_nuvs_sequence(document, sequence_index) -> None:
    if find_nuvs_sequence_by_index(document, sequence_index) is None:
        raise ResourceNotFoundError()
