"""Workflow exceptions."""

from http import HTTPStatus
from subprocess import SubprocessError


class JobAcquisitionError(Exception):
    """Raised when there is a problem acquiring a job."""

    def __init__(self, body: str, job_id: str, status: HTTPStatus | int) -> None:
        """Initialize a JobAcquisitionError."""
        self.body = body
        self.job_id = job_id
        self.status = HTTPStatus(status)

        super().__init__("Unexpected API error during job acquisition")


class JobAlreadyAcquiredError(Exception):
    """Raised when an attempt is made to reacquire a job."""

    def __init__(self, job_id: str) -> None:
        """Initialize a JobAlreadyAcquiredError with a message containing the job ID."""
        self.job_id = job_id

        super().__init__(
            f"Job {job_id} is has already been acquired.",
        )


class JobsAPICannotConnectError(Exception):
    """Raised when the workflow client cannot connect to the server."""

    def __init__(self) -> None:
        """Initialize a JobsAPICannotConnectError."""
        super().__init__("Unable to connect to server.")


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


class WorkflowStepDescriptionError(Exception):
    """Raised when a workflow step description is invalid."""

    def __init__(self, name: str) -> None:
        """Initialize a WorkflowStepDescriptionError with the affected step name.

        :param step: the workflow step
        """
        super().__init__(f"{name} does not have a docstring")


class SubprocessFailedError(SubprocessError):
    """Subprocess exited with non-zero status during a workflow."""

    def __init__(self, command: list[str], return_code: int) -> None:
        """Initialize a SubprocessFailedError with a command and return code."""
        super().__init__(
            f"Subprocess failed with exit code {return_code}: {' '.join(command)}"
        )
