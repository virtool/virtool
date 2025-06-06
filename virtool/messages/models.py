from datetime import datetime

from virtool.models.base import BaseModel
from virtool.models.enums import MessageColor
from virtool.users.models_base import UserNested


class InstanceMessage(BaseModel):
    id: int
    created_at: datetime
    updated_at: datetime
    message: str
    color: MessageColor
    user: UserNested
    active: bool
