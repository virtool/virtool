from datetime import datetime

from virtool.models.base import BaseModel
from virtool.tasks.models import TaskNested


class NuvsBlast(BaseModel):
    id: int
    created_at: datetime
    updated_at: datetime
    last_checked_at: datetime
    error: str | None
    rid: str | None
    ready: bool = False
    result: dict | None
    task: TaskNested | None
