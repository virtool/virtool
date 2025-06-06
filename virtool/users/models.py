from datetime import datetime

from virtool.groups.models import GroupMinimal, Permissions
from virtool.models import SearchResult
from virtool.models.roles import AdministratorRole
from virtool.users.models_base import UserNested


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
