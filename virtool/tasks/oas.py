from typing import Optional

from pydantic import BaseModel, conint
from virtool_core.models.task import TaskMinimal, Task


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
    step: Optional[str]
    progress: Optional[conint(ge=1, le=100)]
    error: Optional[str]
