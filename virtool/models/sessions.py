from datetime import datetime

from virtool.models import BaseModel


class SessionAuthentication(BaseModel):
    user_id: int | str


class SessionPasswordReset(BaseModel):
    remember: bool
    user_id: int | str


class Session(BaseModel):
    authentication: SessionAuthentication | None
    created_at: datetime
    id: str
    ip: str
    reset: SessionPasswordReset | None
