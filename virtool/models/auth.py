from virtool_core.models.basemodel import BaseModel


class PermissionMinimal(BaseModel):
    id: str
    name: str
    description: str
    resource_type: str
    action: str
