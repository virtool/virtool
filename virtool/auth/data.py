from typing import List

from sqlalchemy.ext.asyncio import AsyncEngine

from virtool_core.models.auth import PermissionMinimal

from virtool.auth.permissions import AppPermissions, GroupPermissions


class AuthData:
    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def find(self, resource_type) -> List[PermissionMinimal]:
        """
        List all possible permissions.

        :return: a list of all permissions

        """
        app_permissions = [
            PermissionMinimal(
                id=permission.value.id,
                name=permission.value.name,
                resource_type=permission.value.resource_type,
                action=permission.value.action,
                description=permission.value.description,
            )
            for permission in AppPermissions
        ]

        group_permissions = [
            PermissionMinimal(
                id=permission.value.id,
                name=permission.value.name,
                resource_type=permission.value.resource_type,
                action=permission.value.action,
                description=permission.value.description,
            )
            for permission in GroupPermissions
        ]

        if not resource_type:
            return [*app_permissions, *group_permissions]

        if resource_type.value == "app":
            return app_permissions

        if resource_type.value == "group":
            return group_permissions
