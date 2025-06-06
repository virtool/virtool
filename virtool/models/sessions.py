from datetime import datetime
from typing import Optional

from virtool_core.models.basemodel import BaseModel


class SessionAuthentication(BaseModel):
    user_id: str


class SessionPasswordReset(BaseModel):
    remember: bool
    user_id: str


class Session(BaseModel):
    authentication: Optional[SessionAuthentication]
    created_at: datetime
    id: str
    ip: str
    reset: Optional[SessionPasswordReset]
