from datetime import datetime

from virtool_core.models.basemodel import BaseModel
from virtool_core.models.enums import MessageColor
from virtool_core.models.user import UserNested


class InstanceMessage(BaseModel):
    id: int
    created_at: datetime
    updated_at: datetime
    message: str
    color: MessageColor
    user: UserNested
    active: bool
