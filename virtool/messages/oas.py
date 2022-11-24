from typing import Optional

from pydantic import BaseModel, validator


class CreateMessageRequest(BaseModel):
    color: str
    message: str


class UpdateMessageRequest(BaseModel):
    color: Optional[str]
    message: Optional[str]
    active: Optional[bool]

    @validator("active")
    def active_must_be_false(cls, active: bool) -> bool:
        if active:
            raise ValueError("active can only be `False` when updating")
        return active
