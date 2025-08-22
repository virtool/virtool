"""Workflow exceptions."""

from subprocess import SubprocessError


class JobAlreadyAcquiredError(Exception):
    """Raised when an attempt is made to reacquire a job."""

    def __init__(self, job_id: str) -> None:
        """Initialize the exception with a message containing the job ID."""
        super().__init__(
            f"Job {job_id} is has already been acquired.",
        )


class JobsAPIError(Exception):
    """A base exception for errors due to HTTP errors from the jobs API."""


class JobsAPIBadRequestError(JobsAPIError):
    """A ``400 Bad Request`` response was received from the jobs API."""

    status = 400


class JobsAPIForbiddenError(JobsAPIError):
    """A ``403 Forbidden`` response was received from the jobs API."""

    status = 403


class JobsAPINotFoundError(JobsAPIError):
    """A ``404 Not Found`` response was received from the jobs API."""

    status = 404


class JobsAPIConflictError(JobsAPIError):
    """A ``409 Conflict`` response was received from the jobs API."""

    status = 409


class JobsAPIServerError(JobsAPIError):
    """A ``500 Internal Server Error`` response was received from the jobs API."""

    status = 500


class MissingJobArgumentError(ValueError):
    """The `job.args` dict is missing a required key for some funcionality."""


class WorkflowStepsError(Exception):
    """Raised when no workflow steps are found in a module."""

    def __init__(self, module: str) -> None:
        super().__init__(f"No workflow steps could be found in {module}")


class SubprocessFailedError(SubprocessError):
    """Subprocess exited with non-zero status during a workflow."""
