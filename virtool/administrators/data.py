import asyncio
from typing import TYPE_CHECKING, Optional, Union, Dict

from multidict import MultiDictProxy
from virtool_core.models.administrator import (
    Administrator,
    AdministratorSearch,
)
from virtool_core.models.roles import AdministratorRole

import virtool
from virtool.administrators.db import update_legacy_administrator
from virtool.administrators.oas import (
    UpdateAdministratorRoleRequest,
)
from virtool.administrators.oas import UpdateUserRequest
from virtool.api.utils import paginate_aggregate, compose_regex_query
from virtool.authorization.client import AuthorizationClient
from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.data.errors import (
    ResourceNotFoundError,
    ResourceConflictError,
)
from virtool.data.piece import DataLayerPiece
from virtool.errors import DatabaseError
from virtool.groups.db import lookup_groups_minimal_by_id, lookup_group_minimal_by_id
from virtool.users.db import (
    fetch_complete_user,
    compose_primary_group_update,
    update_keys,
    compose_groups_update,
)
from virtool.utils import base_processor

if TYPE_CHECKING:
    from virtool.mongo.core import DB


PROJECTION = [
    "_id",
    "handle",
    "administrator",
    "force_reset",
    "groups",
    "last_password_change",
    "permissions",
    "primary_group",
    "administrator_role",
    "active",
    "b2c",
    "b2c_display_name",
    "b2c_family_name",
    "b2c_given_name",
    "b2c_oid",
]


class AdministratorsData(DataLayerPiece):
    def __init__(self, authorization_client: AuthorizationClient, mongo: "DB"):
        self._authorization_client = authorization_client
        self._mongo = mongo

    # TODO add type hints for return values
    async def find_users(
        self,
        url_query: Union[Dict, MultiDictProxy[str]],
        administrator: Optional[bool] = None,
        term: Optional[str] = None,
    ) -> AdministratorSearch:

        test = await self._authorization_client.list_administrators()

        admin_dict = {
            admin[0]: admin[1]
            for admin in await self._authorization_client.list_administrators()
        }

        administrator_query = {}
        if administrator is not None:
            operator = "$in" if administrator else "$nin"
            administrator_query = {"_id": {operator: list(admin_dict.keys())}}

        term_query = compose_regex_query(term, ["handle"]) if term else {}

        client_query = {
            **administrator_query,
            **term_query,
        }

        result = await paginate_aggregate(
            self._mongo.users,
            client_query,
            url_query,
            sort="handle",
            transforms=[
                *lookup_groups_minimal_by_id(local_field="groups"),
                *lookup_group_minimal_by_id(
                    local_field="primary_group", set_as="primary_group"
                ),
            ],
            projection={field: True for field in PROJECTION},
        )

        for user in result["documents"]:
            user["role"] = admin_dict.get(user["_id"], None)

        return result

    # TODO add type hints for return values
    async def get_user(self, user_id: str):
        """
        Get a user.

        :param user_id: the user ID
        :return: the user
        """

        user, admin_tuple = await asyncio.gather(
            fetch_complete_user(self._mongo, user_id),
            self._authorization_client.get_administrator(user_id),
        )

        if not user:
            raise ResourceNotFoundError

        return {
            **base_processor(user),
            "role": admin_tuple[1],
        }

    # TODO add type hints for return values
    async def update_user(self, user_id: str, data: UpdateUserRequest):
        """
        Update a user.

        Sessions and API keys are updated as well.

        :param user_id: the ID of the user to update
        :param data: the update data object
        :return: the updated user
        """
        document = await self._mongo.users.find_one({"_id": user_id})

        if document is None:
            raise ResourceNotFoundError("User does not exist")

        data = data.dict(exclude_unset=True)

        update = {}

        if "force_reset" in data:
            update.update(
                {"force_reset": data["force_reset"], "invalidate_sessions": True}
            )

        if "password" in data:
            update.update(
                {
                    "password": virtool.users.utils.hash_password(data["password"]),
                    "last_password_change": virtool.utils.timestamp(),
                    "invalidate_sessions": True,
                }
            )

        if "groups" in data:
            try:
                update.update(await compose_groups_update(self._mongo, data["groups"]))
            except DatabaseError as err:
                raise ResourceConflictError(str(err))

        if "primary_group" in data:
            try:
                update.update(
                    await compose_primary_group_update(
                        self._mongo, user_id, data["primary_group"]
                    )
                )
            except DatabaseError as err:
                raise ResourceConflictError(str(err))

        if "active" in data:
            update.update({"active": data["active"], "invalidate_sessions": True})

        if update:
            document = await self._mongo.users.find_one_and_update(
                {"_id": user_id}, {"$set": update}
            )

            await update_keys(
                self._mongo,
                user_id,
                document["administrator"],
                document["groups"],
                document["permissions"],
            )

        user = await fetch_complete_user(self._mongo, user_id)

        if user is None:
            raise ResourceNotFoundError

        admin_tuple = await self._authorization_client.get_administrator(user_id)

        return {**user.dict(), "role": admin_tuple[1]}

    # TODO add type hints for return values
    async def update_role(
        self, user_id: str, /, data: UpdateAdministratorRoleRequest
    ) -> Administrator:
        """
        Update a user's administrator role.

        Set the user's administrator flag to true if given the full role and false otherwise.

        :param data: fields to add a user as an administrator
        :return: the administrator
        """

        if await self._mongo.users.find_one(user_id):
            await update_legacy_administrator(self._mongo, user_id, data.role)

            if data.role is None:
                await self._delete(user_id)
            else:
                await self._authorization_client.add(
                    AdministratorRoleAssignment(user_id, AdministratorRole(data.role))
                )

            user = await self.get_user(user_id)

            await update_keys(
                self._mongo,
                user["id"],
                user["administrator"],
                user["groups"],
                user["permissions"],
            )

            return user

        raise ResourceNotFoundError()

    # TODO add type hints for return values

    async def _delete(self, user_id: str) -> None:
        """
        Remove an administrator.

        :param user_id: the user ID
        """
        admin_tuple = await self._authorization_client.get_administrator(user_id)
        if admin_tuple[1] is not None:
            await self._authorization_client.remove(
                AdministratorRoleAssignment(user_id, AdministratorRole(admin_tuple[1]))
            )

        return

    async def promote_administrators(self):

        for user_id in await self._mongo.users.distinct("_id", {"administrator": True}):
            await self._authorization_client.add(
                AdministratorRoleAssignment(user_id, AdministratorRole.FULL)
            )
