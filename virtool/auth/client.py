import asyncio
from typing import Union, List

from openfga_sdk import ApiClient
from virtool_core.models.enums import Permission

from virtool.api.response import NotFound
from virtool.auth.mongo import (
    check_in_mongo,
    list_permissions_in_mongo,
    add_in_mongo,
    remove_in_mongo,
)
from virtool.auth.openfga import (
    check_in_open_fga,
    list_permissions_in_open_fga,
    add_group_permissions_in_open_fga,
    add_user_permissions_in_open_fga,
    remove_group_permissions_in_open_fga,
    remove_user_permissions_in_open_fga,
)
from virtool.data.layer import DataLayer

from virtool.mongo.core import DB


class AbstractAuthorizationClient:
    def __init__(self, mongo: DB, open_fga: ApiClient, data: DataLayer = None):
        self.mongo = mongo
        self.open_fga = open_fga
        self.data = data

    async def check(
        self,
        user_id: str,
        permission: Permission,
        object_type: str,
        object_id: Union[str, int],
    ) -> bool:
        """
        Check a permission in Mongo and OpenFGA.
        """

        mongo_result, open_fga_result = await asyncio.gather(
            *[
                check_in_mongo(self.mongo, user_id, permission),
                check_in_open_fga(
                    self.open_fga, user_id, permission, object_type, object_id
                ),
            ]
        )

        return mongo_result or open_fga_result

    async def list_permissions(
        self, user_id: str, object_type: str, object_id: Union[str, int]
    ) -> dict:
        """
        List permissions for a user.
        """
        try:
            return await list_permissions_in_mongo(self.mongo, user_id)
        except NotFound:
            return await list_permissions_in_open_fga(
                    self.open_fga, user_id, object_type, object_id
                )

    async def add_group_permissions(
        self,
        group_id: str,
        permissions: List[Permission],
        object_type: str,
        object_id: Union[str, int],
    ):
        """
        Add permissions to a group in Mongo and OpenFGA.
        """

        await asyncio.gather(
            *[
                add_in_mongo(self.data, group_id, permissions),
                add_group_permissions_in_open_fga(
                    self.open_fga, group_id, permissions, object_type, object_id
                ),
            ],
            return_exceptions=True
        )

    async def add_user_permissions(
        self,
        user_id: str,
        permissions: List[Permission],
        object_type: str,
        object_id: Union[str, int],
    ):
        """
        Add permissions for a user in OpenFGA.
        """

        await add_user_permissions_in_open_fga(
            self.open_fga, user_id, permissions, object_type, object_id
        )

    async def remove_group_permissions(
        self,
        group_id: str,
        permissions: List[Permission],
        object_type: str,
        object_id: Union[str, int],
    ):
        """
        Remove permissions from a group in Mongo and OpenFGA.
        """

        await asyncio.gather(
            *[
                remove_in_mongo(self.data, group_id, permissions),
                remove_group_permissions_in_open_fga(
                    self.open_fga, group_id, permissions, object_type, object_id
                ),
            ],
            return_exceptions=True
        )

    async def remove_user_permissions(
        self,
        user_id: str,
        permissions: List[Permission],
        object_type: str,
        object_id: Union[str, int],
    ):
        """
        Remove permissions from a user in OpenFGA.
        """

        await remove_user_permissions_in_open_fga(
            self.open_fga, user_id, permissions, object_type, object_id
        )
