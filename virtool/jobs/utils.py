from virtool_core.models.job import JobState

import virtool.utils
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
    state: JobState | None,
    stage: str | None,
    step_name: str | None = None,
    step_description: str | None = None,
    error: dict | None = None,
    progress: int | None = 0,
) -> Document:
    """Compose a status subdocument for a job.

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
    """Return a boolean indicating whether the passed job is running or waiting."""
    return document["status"][-1]["state"] in ("waiting", "running")
