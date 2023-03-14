from datetime import datetime
from typing import Optional

from virtool.analyses.utils import find_nuvs_sequence_by_index
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
    ResourceNotModifiedError,
)


async def check_if_analysis_modified(
    if_modified_since: Optional[datetime], document: dict
):
    if if_modified_since is not None:
        try:
            if if_modified_since == document["updated_at"]:
                raise ResourceNotModifiedError()
        except KeyError:
            if if_modified_since == document["created_at"]:
                raise ResourceNotModifiedError()


async def check_if_analysis_ready(jobs_api_flag: bool, ready: bool):
    if jobs_api_flag and ready:
        raise ResourceConflictError()

    if not ready:
        raise ResourceConflictError()


async def check_analysis_workflow(workflow: str):
    if workflow != "nuvs":
        raise ResourceConflictError("Not a NuVs analysis")


async def check_if_analysis_running(ready: bool):
    if not ready:
        raise ResourceConflictError("Analysis is still running")


async def check_analysis_nuvs_sequence(document, sequence_index):
    sequence = find_nuvs_sequence_by_index(document, sequence_index)

    if sequence is None:
        raise ResourceNotFoundError()
