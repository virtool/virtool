from pydantic import conint

from virtool.models import BaseModel


class UpdateTaskRequest(BaseModel):
    """Request model for updating a task."""

    step: str | None
    progress: conint(ge=0, le=100) | None
    error: str | None
