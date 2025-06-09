from datetime import datetime
from typing import Any

from virtool.models import BaseModel


class TaskNested(BaseModel):
    id: int


class TaskDetailedNested(TaskNested):
    complete: bool
    created_at: datetime
    error: str | None = None
    progress: int
    step: str | None
    type: str


class Task(TaskDetailedNested):
    context: dict[str, Any]
    count: int
    file_size: int | None = None

    class Config:
        schema_extra = {
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
            }
        }


TaskMinimal = Task
