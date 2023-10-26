import asyncio

from pymongo.errors import DuplicateKeyError
from sqlalchemy import select, update, delete, insert
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool_core.models.roles import AdministratorRole
from virtool_core.models.user import User, UserSearchResult

import virtool.users.utils
import virtool.utils
from virtool.administrators.db import update_legacy_administrator
from virtool.api.utils import compose_regex_query, paginate_aggregate
from virtool.authorization.client import AuthorizationClient
from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.events import emits, Operation
from virtool.data.topg import compose_legacy_id_expression, both_transactions
from virtool.data.transforms import apply_transforms
from virtool.errors import DatabaseError
from virtool.groups.pg import merge_group_permissions, SQLGroup
from virtool.groups.transforms import AttachPrimaryGroupTransform, AttachGroupsTransform
from virtool.mongo.core import Mongo
from virtool.mongo.utils import id_exists
from virtool.users.db import (
    B2CUserAttributes,
    compose_groups_update,
)
from virtool.users.mongo import (
    create_user,
    update_keys,
    compose_primary_group_update,
    generate_handle,
)
from virtool.users.oas import UpdateUserRequest
from virtool.users.pg import SQLUser, user_group_associations
from virtool.users.transforms import AttachPermissionsTransform
from virtool.utils import base_processor

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
                        AttachPermissionsTransform(self._pg),
                        AttachPrimaryGroupTransform(self._pg),
                        AttachGroupsTransform(self._pg),
                    ],
                )
            ),
            administrator_role=role,
        )

    @emits(Operation.CREATE)
    async def create(
        self,
        handle: str,
        password: str | None,
        force_reset: bool = False,
        b2c_user_attributes: B2CUserAttributes | None = None,
    ) -> User:
        """
        Create a new user.

        If Azure AD B2C information is given, add it to user document.

        :param handle: the requested handle for the user
        :param password: a password
        :param force_reset: force the user to reset password on next login
        :param  b2c_user_attributes: Azure b2c user attributes used to describe a user
        :return: the user document
        """
        async with both_transactions(self._mongo, self._pg) as (mongo, pg):
            now = virtool.utils.timestamp()

            document = await create_user(
                self._mongo,
                handle,
                password,
                force_reset,
                b2c_user_attributes=b2c_user_attributes,
                session=mongo,
            )

            pg.add(
                SQLUser(
                    legacy_id=document["_id"],
                    handle=handle,
                    password=document["password"] if password else None,
                    force_reset=force_reset,
                    last_password_change=now,
                    b2c_display_name=b2c_user_attributes.display_name
                    if b2c_user_attributes
                    else "",
                    b2c_given_name=b2c_user_attributes.given_name
                    if b2c_user_attributes
                    else "",
                    b2c_family_name=b2c_user_attributes.family_name
                    if b2c_user_attributes
                    else "",
                    b2c_oid=b2c_user_attributes.oid if b2c_user_attributes else "",
                )
            )

        return await self.get(document["_id"])

    async def delete(self, legacy_id: str):
        async with both_transactions(self._mongo, self._pg) as (mongo, pg):
            await pg.execute(delete(SQLUser).where(legacy_id=legacy_id))
            await self._mongo.users.deleteOne(_id=legacy_id, session=mongo)

    async def delete_all(self):
        async with both_transactions(self._mongo, self._pg) as (mongo, pg):
            await pg.execute(delete(SQLUser))
            await self._mongo.users.delete_many({}, session=mongo)

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

        async with both_transactions(self._mongo, self._pg) as (mongo, pg):
            now = virtool.utils.timestamp()

            document = await create_user(
                self._mongo, handle, password, False, session=mongo
            )
            await self._mongo.users.update_one(
                {"_id": document["_id"]},
                {"$set": {"administrator": True}},
                session=mongo,
            )
            user = SQLUser(
                legacy_id=document["_id"],
                handle=handle,
                password=document["password"],
                force_reset=False,
                last_password_change=now,
            )
            pg.add(user)

        await self.set_administrator_role(document["_id"], AdministratorRole.FULL)

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

        handle = await generate_handle(
            self._mongo.users,
            b2c_user_attributes.given_name,
            b2c_user_attributes.family_name,
        )

        try:
            user = await self.create(
                handle, None, False, b2c_user_attributes=b2c_user_attributes
            )
        except DuplicateKeyError:
            return await self.find_or_create_b2c_user(b2c_user_attributes)

        return user

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

        async with both_transactions(self._mongo, self._pg) as (mongo, pg):
            await update_legacy_administrator(self._mongo, user_id, role, mongo)
            await pg.execute(
                update(SQLUser)
                .where(SQLUser.legacy_id == user_id)
                .values(administrator=role == AdministratorRole.FULL)
            )

            if role is None:
                # Clear the user's administrator role.
                admin_tuple = await self._authorization_client.get_administrator(
                    user_id
                )

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

        user = await self.get(user_id)

        return user

    # TODO: Update this one to use both_transactions
    @emits(Operation.UPDATE)
    async def update(self, user_id: str, data: UpdateUserRequest):
        """
        Update a user.

        Sessions and API keys are updated as well.

        :param user_id: the ID of the user to update
        :param data: the update data object
        :return: the updated user
        """
        async with both_transactions(self._mongo, self._pg) as (mongo, pg):
            document = await self._mongo.users.find_one(
                {"_id": user_id}, ["administrator", "groups"], session=mongo
            )

            user = (
                await pg.execute(
                    select(SQLUser).where(SQLUser.legacy_id == user_id).limit(1)
                )
            ).scalar()

            if document is None or user is None:
                raise ResourceNotFoundError("User does not exist")

            data = data.dict(exclude_unset=True)

            updates = {}

            if "administrator" in data:
                updates["administrator"] = data["administrator"]
                user.administrator = data["administrator"]

                role_assignment = AdministratorRoleAssignment(
                    user_id, AdministratorRole.FULL
                )

                if data["administrator"]:
                    await self._authorization_client.add(role_assignment)
                else:
                    await self._authorization_client.remove(role_assignment)

            if "force_reset" in data:
                updates.update(
                    {"force_reset": data["force_reset"], "invalidate_sessions": True}
                )
                user.force_reset = data["force_reset"]
                user.invalidate_sessions = True

            if "password" in data:
                hashedpass = virtool.users.utils.hash_password(data["password"])
                timestamp = virtool.utils.timestamp()
                updates.update(
                    {
                        "password": hashedpass,
                        "last_password_change": timestamp,
                        "invalidate_sessions": True,
                    }
                )
                user.password = hashedpass
                user.last_password_change = timestamp
                user.invalidate_sessions = True

            if "groups" in data:
                try:
                    updates.update(
                        await compose_groups_update(self._pg, data["groups"])
                    )
                    for _id in data["groups"]:
                        await pg.execute(
                            insert(user_group_associations).values(
                                user_id=user.id, group_id=_id
                            )
                        )

                except DatabaseError as err:
                    raise ResourceConflictError(str(err))

            if "primary_group" in data:
                try:
                    primary_group = await compose_primary_group_update(
                        self._mongo,
                        self._pg,
                        data.get("groups", []),
                        data["primary_group"],
                        user_id,
                    )

                except DatabaseError as err:
                    raise ResourceConflictError(str(err))
                updates.update(primary_group)
                user.primary_group = primary_group.values()

            if "active" in data:
                updates.update({"active": data["active"], "invalidate_sessions": True})
                user.active = data["active"]
                user.invalidate_sessions = True

            if updates:
                document = await self._mongo.users.find_one_and_update(
                    {"_id": user_id}, {"$set": updates}, session=mongo
                )

                if document["groups"]:
                    result = await pg.execute(
                        select(SQLGroup).where(
                            compose_legacy_id_expression(SQLGroup, document["groups"])
                        )
                    )

                    groups = [group.to_dict() for group in result.scalars().all()]
                else:
                    groups = []

                await update_keys(
                    self._mongo,
                    user_id,
                    document["administrator"],
                    document["groups"],
                    merge_group_permissions(groups),
                    session=mongo,
                )
        return await self.get(user_id)

    async def check_users_exist(self) -> bool:
        """
        Checks that users exist.

        :returns: True if users exist otherwise False
        """
        return await self._mongo.users.count_documents({}, limit=1) > 0
