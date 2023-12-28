import asyncio
import random

from pymongo.errors import DuplicateKeyError
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool_core.models.roles import AdministratorRole
from virtool_core.models.user import User, UserSearchResult

import virtool.users.utils
import virtool.utils
from virtool.api.utils import compose_regex_query, paginate_aggregate
from virtool.authorization.client import AuthorizationClient
from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
    ResourceError,
)
from virtool.data.events import emits, Operation
from virtool.data.transforms import apply_transforms
from virtool.errors import DatabaseError
from virtool.groups.transforms import AttachPrimaryGroupTransform, AttachGroupsTransform
from virtool.mongo.core import Mongo
from virtool.mongo.utils import id_exists, get_one_field
from virtool.users.db import (
    B2CUserAttributes,
    compose_groups_update,
)
from virtool.users.mongo import create_user, compose_primary_group_update
from virtool.users.oas import UpdateUserRequest
from virtool.users.transforms import AttachPermissionsTransform
from virtool.utils import base_processor

PROJECTION = [
    "_id",
    "active",
    "b2c",
    "b2c_display_name",
    "b2c_family_name",
    "b2c_given_name",
    "b2c_oid",
    "handle",
    "force_reset",
    "groups",
    "last_password_change",
    "permissions",
    "primary_group",
]


class UsersData(DataLayerDomain):
    name = "users"

    def __init__(
        self, authorization_client: AuthorizationClient, mongo: Mongo, pg: AsyncEngine
    ):
        self._authorization_client = authorization_client
        self._mongo = mongo
        self._pg = pg

    async def find(
        self,
        page: int,
        per_page: int,
        administrator: bool | None = None,
        term: str | None = None,
    ) -> UserSearchResult:
        """
        Find users.

        Optionally filter by administrator status or search term.

        :param page: the page number
        :param per_page: the number of items per page
        :param administrator: whether to filter by administrator status
        :param term: a search term to filter by user handle
        """

        administrator_roles = dict(
            await self._authorization_client.list_administrators()
        )

        administrator_query = {}

        if administrator is not None:
            operator = "$in" if administrator else "$nin"
            administrator_query = {"_id": {operator: list(administrator_roles.keys())}}

        term_query = compose_regex_query(term, ["handle"]) if term else {}

        client_query = {**administrator_query, **term_query}

        result = await paginate_aggregate(
            self._mongo.users,
            page,
            per_page,
            client_query,
            sort="handle",
            projection={field: True for field in PROJECTION},
        )

        result["items"] = await apply_transforms(
            [base_processor(item) for item in result["items"]],
            [
                AttachPermissionsTransform(self._pg),
                AttachPrimaryGroupTransform(self._pg),
                AttachGroupsTransform(self._pg),
            ],
        )

        result["items"] = [
            User(**user, administrator_role=administrator_roles.get(user["id"]))
            for user in result["items"]
        ]

        return UserSearchResult(**result)

    async def get(self, user_id: str) -> User:
        """
        Get a user by their ``user_id``.

        :param user_id: the user's ID
        :return: the user
        """
        user, (user_id, role) = await asyncio.gather(
            self._mongo.users.find_one(
                {"_id": user_id},
            ),
            self._authorization_client.get_administrator(user_id),
        )

        if not user:
            raise ResourceNotFoundError("User does not exist")

        return User(
            **(
                await apply_transforms(
                    base_processor(user),
                    [
                        AttachGroupsTransform(self._pg),
                        AttachPermissionsTransform(self._pg),
                        AttachPrimaryGroupTransform(self._pg),
                    ],
                )
            ),
            administrator_role=role,
        )

    async def get_by_handle(self, handle: str) -> User:
        """
        Get a user by their ``handle``.

        :param handle: the user's unique handle
        :return: the user
        """
        user_id = await get_one_field(self._mongo.users, "_id", {"handle": handle})

        if not user_id:
            raise ResourceError(f"No user found with handle '{handle}'")

        return await self.get(user_id)

    @emits(Operation.CREATE)
    async def create(
        self, handle: str, password: str, force_reset: bool = False
    ) -> User:
        """
        Create a new user.

        If Azure AD B2C information is given, add it to user document.

        :param handle: the requested handle for the user
        :param password: a password
        :param force_reset: force the user to reset password on next login
        :return: the user document
        """
        document = await create_user(self._mongo, handle, password, force_reset)
        return await self.get(document["_id"])

    async def create_first(self, handle: str, password: str) -> User:
        """
        Create the first instance user.

        :param handle: the user handle
        :param password: the password
        :return:
        """
        if await self.check_users_exist():
            raise ResourceConflictError("Virtool already has at least one user")

        if handle == "virtool":
            raise ResourceConflictError("Reserved user name: virtool")

        document = await create_user(self._mongo, handle, password, False)

        await self._authorization_client.add(
            AdministratorRoleAssignment(document["_id"], AdministratorRole.FULL)
        )

        return await self.get(document["_id"])

    async def find_or_create_b2c_user(
        self, b2c_user_attributes: B2CUserAttributes
    ) -> User:
        """
        Search for existing user using an OID.

        If not found, create new user with the OID and user attributes. Auto-generate a
        handle.

        :param b2c_user_attributes: User attributes collected from ID token claims
        :return: the found or created user
        """
        if document := await self._mongo.users.find_one(
            {"b2c_oid": b2c_user_attributes.oid}, ["_id"]
        ):
            return await self.get(document["_id"])

        handle = "-".join(
            [
                b2c_user_attributes.given_name,
                b2c_user_attributes.family_name,
                str(random.randint(1, 100)),
            ]
        )

        try:
            document = await create_user(
                self._mongo,
                handle,
                None,
                False,
                b2c_user_attributes=b2c_user_attributes,
            )
        except DuplicateKeyError:
            return await self.find_or_create_b2c_user(b2c_user_attributes)

        return await self.get(document["_id"])

    async def set_administrator_role(
        self, user_id: str, role: AdministratorRole
    ) -> User:
        """
        Set a user's administrator role.

        Sets the user's legacy administrator flag to ``True`` if the ``FULL`` user role
        is set. Otherwise, sets the flag to ``False``.

        :param user_id: the id of the user to set the role of
        :param role: the administrator role
        :return: the administrator
        """

        if not await id_exists(self._mongo.users, user_id):
            raise ResourceNotFoundError("User does not exist")

        if role is None:
            # Clear the user's administrator role.
            admin_tuple = await self._authorization_client.get_administrator(user_id)

            if admin_tuple[1] is not None:
                await self._authorization_client.remove(
                    AdministratorRoleAssignment(
                        user_id, AdministratorRole(admin_tuple[1])
                    )
                )
        else:
            await self._authorization_client.add(
                AdministratorRoleAssignment(user_id, AdministratorRole(role))
            )

        return await self.get(user_id)

    @emits(Operation.UPDATE)
    async def update(self, user_id: str, data: UpdateUserRequest):
        """
        Update a user.

        Sessions and API keys are updated as well.

        :param user_id: the ID of the user to update
        :param data: the update data object
        :return: the updated user
        """
        if not await id_exists(self._mongo.users, user_id):
            raise ResourceNotFoundError("User does not exist")

        data = data.dict(exclude_unset=True)

        update = {}

        if "active" in data:
            update.update({"active": data["active"], "invalidate_sessions": True})

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
                update.update(await compose_groups_update(self._pg, data["groups"]))
            except DatabaseError as err:
                raise ResourceConflictError(str(err))

        if "primary_group" in data:
            try:
                update.update(
                    await compose_primary_group_update(
                        self._mongo,
                        self._pg,
                        data.get("groups", []),
                        data["primary_group"],
                        user_id,
                    )
                )
            except DatabaseError as err:
                raise ResourceConflictError(str(err))

        if update:
            await self._mongo.users.update_one({"_id": user_id}, {"$set": update})

        return await self.get(user_id)

    async def check_users_exist(self) -> bool:
        """
        Checks that users exist.

        :returns: True if users exist otherwise False
        """
        return await self._mongo.users.count_documents({}, limit=1) > 0
