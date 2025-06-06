from virtool.models import BaseModel


class PermissionMinimal(BaseModel):
    id: str
    name: str
    description: str
    resource_type: str
    action: str
