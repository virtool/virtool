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

    class Config:
        schema_extra = {
            "example": {
                "id": 1,
                "active": True,
                "color": "red",
                "message": "Administrative instance message",
                "created_at": "2021-11-24T19:40:03.320000Z",
                "updated_at": "2021-11-24T19:40:03.320000Z",
                "user": {"id": "ian", "handle": "ianboyes", "administrator": True},
            }
        }
