from datetime import datetime

from virtool_core.models.basemodel import BaseModel
from virtool_core.models.task import TaskNested


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
