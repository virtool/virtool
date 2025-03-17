from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field
from virtool_core.models.task import Task, TaskMinimal

from virtool.validation import Unset, UnsetType


class TaskMinimalResponse(TaskMinimal):
    """A model for a minimal task list item in a response."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": [
                {
                    "complete": True,
                    "context": {"user_id": "virtool"},
                    "created_at": "2021-11-24T19:40:03.320000Z",
                    "error": None,
                    "file_size": None,
                    "id": 2,
                    "progress": 100,
                    "step": "remove_referenced_otus",
                    "type": "delete_reference",
                },
            ],
        },
    )


class TaskResponse(Task):
    """A response model for a task."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "complete": True,
                "context": {"user_id": "virtool"},
                "created_at": "2021-11-24T19:40:03.320000Z",
                "error": None,
                "file_size": None,
                "id": 2,
                "progress": 100,
                "step": "remove_referenced_otus",
                "type": "delete_reference",
            },
        },
    )


class TaskUpdate(BaseModel):
    """A model for an update to a task."""

    step: str | UnsetType = Unset
    """The current step of the task."""

    progress: Annotated[int | UnsetType, Field(default=Unset, ge=0, le=100)]
    """The progress of the task."""

    error: str | UnsetType = Unset
    """An error message for the task."""
