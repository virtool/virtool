from pydantic import conint

from virtool.models import BaseModel
from virtool.tasks.models import Task, TaskMinimal


class GetTasksResponse(TaskMinimal):
    class Config:
        schema_extra = {
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
                }
            ]
        }


class TaskResponse(Task):
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


class TaskUpdate(BaseModel):
    step: str | None
    progress: conint(ge=0, le=100) | None
    error: str | None
