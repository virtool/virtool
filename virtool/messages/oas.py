from pydantic import BaseModel, Field, field_validator
from virtool_core.models.enums import MessageColor
from virtool_core.models.instancemessage import InstanceMessage

from virtool.validation import Unset, UnsetType


class MessageCreateRequest(BaseModel):
    """A request model for creating a new instance message."""

    color: MessageColor = Field(description="A highlight color.")
    message: str = Field(description="The message content.")


class MessageUpdateRequest(BaseModel):
    """A request validation model for updating an instance message."""

    active: bool | UnsetType = Field(
        default=Unset,
        description="Whether the message will be displayed.",
    )

    color: MessageColor | UnsetType = Field(
        default=Unset,
        description="A highlight color.",
    )

    message: str | UnsetType = Field(
        default=Unset,
        description="The message content.",
    )

    @field_validator("active")
    @classmethod
    def check_active(cls: type, active: bool) -> bool:
        """Check that the active field is `False`."""
        if active is not False:
            msg = "active must be `False`"
            raise ValueError(msg)

        return active


class MessageResponse(InstanceMessage):
    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "active": True,
                "color": "red",
                "message": "Administrative instance message",
                "created_at": "2021-11-24T19:40:03.320000Z",
                "updated_at": "2021-11-24T19:40:03.320000Z",
                "user": {"id": "ian", "handle": "ianboyes", "administrator": True},
            },
        }


class CreateMessageResponse(InstanceMessage):
    class Config:
        json_schema_extra = {
            "example": {
                "id": 3,
                "active": True,
                "color": "yellow",
                "message": "Third instance message",
                "created_at": "2022-11-24T19:40:03.320000Z",
                "updated_at": "2022-11-24T19:40:03.320000Z",
                "user": {"id": "ian", "handle": "ianboyes", "administrator": True},
            },
        }


class UpdateMessageResponse(InstanceMessage):
    class Config:
        json_schema_extra = {
            "example": {
                "id": 3,
                "active": True,
                "color": "red",
                "message": "Changed the third instance message",
                "created_at": "2022-11-24T19:40:03.320000Z",
                "updated_at": "2022-11-24T19:40:03.320000Z",
                "user": {"id": "ian", "handle": "ianboyes", "administrator": True},
            },
        }
