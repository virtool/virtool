from virtool.models import BaseModel


class UserNested(BaseModel):
    id: int
    handle: str
