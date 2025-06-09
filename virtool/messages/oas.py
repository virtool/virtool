from pydantic import BaseModel, validator

from virtool.models.enums import MessageColor
from virtool.models.validators import prevent_none


class CreateMessageRequest(BaseModel):
    color: MessageColor
    message: str


class UpdateMessageRequest(BaseModel):
    color: MessageColor | None
    message: str | None
    active: bool | None

    _prevent_none = prevent_none("*")

    @validator("active")
    def active_must_be_false(cls, active: bool) -> bool:
        if active:
            raise ValueError("active can only be `False` when updating")
        return active
