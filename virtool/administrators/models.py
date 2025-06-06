from virtool.models.base import BaseModel
from virtool.models.roles import AdministratorRole
from virtool.users.models_base import UserNested


class AdministratorMinimal(UserNested):
    role: AdministratorRole


class Administrator(AdministratorMinimal):
    available_roles: list[dict]


class AdministratorSearch(BaseModel):
    items: list[AdministratorMinimal]
    available_roles: list[dict]
