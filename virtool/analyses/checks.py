from datetime import datetime

from virtool.data.errors import (
    ResourceConflictError,
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
