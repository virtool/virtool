from typing import Dict, List, Optional, Sequence, Union

from virtool_core.models.job import JobState

import virtool.utils
from virtool.http.rights import MODIFY, READ, REMOVE, Right
from virtool.types import Document

WORKFLOW_NAMES = (
    "jobs_build_index",
    "jobs_create_sample",
    "jobs_create_subtraction",
    "jobs_aodp",
    "jobs_nuvs",
    "jobs_pathoscope_bowtie",
)


def compose_status(
    state: Optional[JobState],
    stage: Optional[str],
    step_name: Optional[str] = None,
    step_description: Optional[str] = None,
    error: Optional[dict] = None,
    progress: Optional[int] = 0,
) -> Document:
    """
    Compose a status subdocument for a job.

    :param state: the current state
    :param stage: the current stage
    :param step_name: the name of the current step
    :param step_description: a description of the current step
    :param error: an error dict
    :param progress: the current progress
    :return: a status subdocument
    """
    return {
        "state": state.value if state else None,
        "stage": stage,
        "step_name": step_name,
        "step_description": step_description,
        "error": error,
        "progress": progress,
        "timestamp": virtool.utils.timestamp(),
    }


def check_job_is_running_or_waiting(document: Document) -> bool:
    """
    Returns a boolean indicating whether the passed job document is in the running or
    waiting state.
    """
    return document["status"][-1]["state"] in ("waiting", "running")
