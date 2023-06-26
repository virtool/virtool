from typing import Optional

from virtool_core.models.roles import AdministratorRole
from virtool_core.models.user import User, UserSearchResult

import virtool
from virtool.administrators.actions import get_action_from_name
from virtool.administrators.db import update_legacy_administrator
from virtool.administrators.oas import UpdateUserRequest
from virtool.api.utils import paginate_aggregate, compose_regex_query
from virtool.authorization.client import AuthorizationClient
from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.data.piece import DataLayerPiece
from virtool.errors import DatabaseError
from virtool.groups.db import lookup_groups_minimal_by_id, lookup_group_minimal_by_id
from virtool.users.db import (
    fetch_complete_user,
    compose_primary_group_update,
    update_keys,
    compose_groups_update,
)

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
    name = "administrators"

    def __init__(self, authorization_client: AuthorizationClient, mongo: "DB"):
        self._authorization_client = authorization_client
        self._mongo = mongo

    async def find(
        self,
        page: int,
        per_page: int,
        administrator: Optional[bool] = None,
        term: Optional[str] = None,
    ) -> UserSearchResult:
        """
        Find users. Optionally filter by administrator status and/or search term.

        :param page: the page number
        :param per_page: the number of items per page
        :param administrator: whether to filter by administrator status
        :param term: a search term to filter by user handle
        """

        administrators = dict(await self._authorization_client.list_administrators())

        administrator_query = {}
        if administrator is not None:
            operator = "$in" if administrator else "$nin"
            administrator_query = {"_id": {operator: list(administrators.keys())}}

        term_query = compose_regex_query(term, ["handle"]) if term else {}

        client_query = {**administrator_query, **term_query}

        result = await paginate_aggregate(
            self._mongo.users,
            page,
            per_page,
            client_query,
            sort="handle",
            lookup_steps=[
                *lookup_groups_minimal_by_id(local_field="groups"),
                *lookup_group_minimal_by_id(
                    local_field="primary_group", set_as="primary_group"
                ),
            ],
            projection={field: True for field in PROJECTION},
        )

        result["items"] = [
            User(**user, administrator_role=administrators.get(user["_id"]))
            for user in result["items"]
        ]

        return UserSearchResult(**result)

    async def get(self, user_id: str) -> User:
        """
        Fetch a complete User including administrator role.

        :param user_id: the user ID
        :return: The complete User
        """

        user = await fetch_complete_user(
            self._mongo, self._authorization_client, user_id
        )

        if not user:
            raise ResourceNotFoundError("User does not exist")

        return user

    async def update(self, user_id: str, data: UpdateUserRequest) -> User:
        """
        Update a user.

        API keys are updated as well.

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

        return await self.get(user_id)

    async def set_administrator_role(
        self, user_id: str, role: AdministratorRole
    ) -> User:
        """
        Update a user's administrator role.

        Set the user's legacy administrator flag to true if given the full role and
        false otherwise.

        :param user_id: the id of the user to set the role of
        :param role: the administrator role
        :return: the administrator
        """

        if await self._mongo.users.find_one(user_id):
            await update_legacy_administrator(self._mongo, user_id, role)

            if role is None:
                await self._clear_administrator_role(user_id)
            else:
                await self._authorization_client.add(
                    AdministratorRoleAssignment(user_id, AdministratorRole(role))
                )

            user = await self.get(user_id)

            await update_keys(
                self._mongo,
                user.id,
                user.administrator,
                user.groups,
                user.permissions.dict(),
            )

            return user

        raise ResourceNotFoundError("User does not exist")

    async def _clear_administrator_role(self, user_id: str) -> None:
        """
        Remove an administrator.

        :param user_id: the user id of the administrator to remove
        """
        admin_tuple = await self._authorization_client.get_administrator(user_id)
        if admin_tuple[1] is not None:
            await self._authorization_client.remove(
                AdministratorRoleAssignment(user_id, AdministratorRole(admin_tuple[1]))
            )

        return

    async def promote_administrators(self):
        """
        Promote all users with the legacy administrator flag to administrators.
        """

        for user_id in await self._mongo.users.distinct("_id", {"administrator": True}):
            await self._authorization_client.add(
                AdministratorRoleAssignment(user_id, AdministratorRole.FULL)
            )

    async def run_action(self, name: str):
        """
        Run an action

        Runs an action with the given name.

        :param name: the name of the action to run
        :return: the result of the action
        """
        return await get_action_from_name(name).run(self.data)
