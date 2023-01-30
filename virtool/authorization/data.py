from typing import List

from virtool_core.models.auth import PermissionMinimal

from virtool.authorization.permissions import AppPermission, SpacePermission


class AuthorizationData:
    @staticmethod
    async def find() -> List[PermissionMinimal]:
        """
        List all possible permissions.

        :return: a list of all permissions

        """
        return [
            *[
                PermissionMinimal(
                    id=permission.name,
                    name=permission.value.name,
                    resource_type=permission.value.resource_type,
                    action=permission.value.action,
                    description=permission.value.description,
                )
                for permission in [
                    *[p for p in AppPermission],
                    *[p for p in SpacePermission],
                ]
            ]
        ]
