from datetime import datetime

from virtool.groups.models import GroupMinimal, Permissions
from virtool.models import BaseModel, SearchResult
from virtool.models.roles import AdministratorRole


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
