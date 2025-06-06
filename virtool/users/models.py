from datetime import datetime

from virtool_core.models.basemodel import BaseModel
from virtool_core.models.group import GroupMinimal, Permissions
from virtool_core.models.roles import AdministratorRole
from virtool_core.models.searchresult import SearchResult


class UserNested(BaseModel):
    id: str
    handle: str


class UserMinimal(UserNested):
    active: bool


class User(UserMinimal):
    administrator_role: AdministratorRole | None
    force_reset: bool
    groups: list[GroupMinimal]
    last_password_change: datetime
    permissions: Permissions
    primary_group: GroupMinimal | None


class UserSearchResult(SearchResult):
    items: list[User]
