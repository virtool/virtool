from typing import Optional

from pydantic import BaseModel, validator
from virtool_core.models.enums import MessageColor
from virtool_core.models.instancemessage import InstanceMessage
from virtool_core.models.validators import prevent_none


class CreateMessageRequest(BaseModel):
    color: MessageColor
    message: str


class UpdateMessageRequest(BaseModel):
    color: Optional[MessageColor]
    message: Optional[str]
    active: Optional[bool]

    _prevent_none = prevent_none('*')

    @validator("active")
    def active_must_be_false(cls, active: bool) -> bool:
        if active:
            raise ValueError("active can only be `False` when updating")
        return active


class MessageResponse(InstanceMessage):
    class Config:
        schema_extra = {
            "example": {
                "id": 1,
                "active": True,
                "color": "red",
                "message": "Administrative instance message",
                "created_at": "2021-11-24T19:40:03.320000Z",
                "updated_at": "2021-11-24T19:40:03.320000Z",
                "user": {"id": "ian", "handle": "ianboyes", "administrator": True}
            }
        }


class CreateMessageResponse(InstanceMessage):
    class Config:
        schema_extra = {
            "example": {
                "id": 3,
                "active": True,
                "color": "yellow",
                "message": "Third instance message",
                "created_at": "2022-11-24T19:40:03.320000Z",
                "updated_at": "2022-11-24T19:40:03.320000Z",
                "user": {"id": "ian", "handle": "ianboyes", "administrator": True}
            }
        }


class UpdateMessageResponse(InstanceMessage):
    class Config:
        schema_extra = {
            "example": {
                "id": 3,
                "active": True,
                "color": "red",
                "message": "Changed the third instance message",
                "created_at": "2022-11-24T19:40:03.320000Z",
                "updated_at": "2022-11-24T19:40:03.320000Z",
                "user": {"id": "ian", "handle": "ianboyes", "administrator": True}
            }
        }
