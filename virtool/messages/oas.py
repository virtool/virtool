from typing import Optional

from pydantic import BaseModel, validator
from virtool_core.models.enums import MessageColor
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
