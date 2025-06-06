from typing import List

from virtool_core.models.basemodel import BaseModel
from virtool_core.models.roles import AdministratorRole
from virtool_core.models.user import UserNested


class AdministratorMinimal(UserNested):
    role: AdministratorRole


class Administrator(AdministratorMinimal):
    available_roles: List[dict]


class AdministratorSearch(BaseModel):
    items: List[AdministratorMinimal]
    available_roles: List[dict]
