from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.auth.client import AuthorizationClient
from virtool.auth.models import SQLPermission
from virtool.auth.openfga import list_all_groups
from virtool.auth.relationships import GroupPermissions
from virtool.mongo.core import DB

from virtool_core.models.auth import PermissionMinimal


class AuthData:
    def __init__(self, auth_client: AuthorizationClient, pg: AsyncEngine, mongo: DB):
        self._auth_client = auth_client
        self._pg = pg
        self._mongo = mongo

    async def find(self, resource_type) -> List[PermissionMinimal]:
        """
        List all possible permissions.

        :return: a list of all permissions

        """
        statement = select(SQLPermission)

        if resource_type:
            statement = statement.filter_by(resource_type=resource_type)

        async with AsyncSession(self._pg) as session:
            result = await session.execute(statement)

        return [
            PermissionMinimal(**permission.to_dict()) for permission in result.scalars()
        ]

    async def sync(self):
        openfga_groups = await list_all_groups(self._auth_client.open_fga)
        async with self._mongo.create_session() as session:
            async for group in self._mongo.groups.find(session=session):
                if group["_id"] not in openfga_groups:
                    permission_list = [
                        permission
                        for permission in group["permissions"]
                        if group["permissions"][permission]
                    ]
                    await self._auth_client.add(
                        GroupPermissions(group["_id"], permission_list)
                    )
