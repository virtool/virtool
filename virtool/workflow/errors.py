"""Workflow exceptions."""

from subprocess import SubprocessError
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from virtool.workflow import WorkflowStep


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


class WorkflowEmptyError(Exception):
    """Raised when no workflow steps are found in a module."""

    def __init__(self, module: str) -> None:
        """Initialize a WorkflowEmptyError with the affected module.

        :param module: the module name
        """
        super().__init__(f"No workflow steps could be found in {module}")


class WorkflowStepDescriptionError(WorkflowEmptyError):
    """Raised when a workflow step description is invalid."""

    def __init__(self, step: "WorkflowStep") -> None:
        """Initialize a WorkflowStepDescriptionError with the affected step.

        :param step: the workflow step
        """
        super().__init__(f"{step} does not have a docstring")


class SubprocessFailedError(SubprocessError):
    """Subprocess exited with non-zero status during a workflow."""

    def __init__(self, command: list[str], return_code: int) -> None:
        """Initialize a SubprocessFailedError with a command and return code."""
        super().__init__(
            f"Subprocess failed with exit code {return_code}: {' '.join(command)}"
        )
