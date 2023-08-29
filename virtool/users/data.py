import random
from typing import Dict, List, Optional, Tuple, Union

from multidict import MultiDictProxy
from pymongo.errors import DuplicateKeyError
from virtool_core.models.roles import AdministratorRole
from virtool_core.models.user import User

import virtool.users.utils
import virtool.utils
from virtool.api.utils import paginate
from virtool.authorization.client import AuthorizationClient
from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.events import Operation, emits
from virtool.data.piece import DataLayerPiece
from virtool.errors import DatabaseError
from virtool.groups.utils import merge_group_permissions
from virtool.types import Projection
from virtool.users.db import (
    B2CUserAttributes,
    compose_groups_update,
    compose_primary_group_update,
    fetch_complete_user,
    update_keys,
)
from virtool.users.mongo import create_user
from virtool.users.oas import UpdateUserRequest
from virtool.utils import base_processor


class UsersData(DataLayerPiece):
    name = "users"

    def __init__(self, authorization_client: AuthorizationClient, mongo, pg):
        self._authorization_client = authorization_client
        self._mongo = mongo
        self._pg = pg

    async def get(self, user_id: str) -> User:
        """
        Get a user by their ``user_id``.

        :param user_id: the user's ID
        :return: the user
        """

        if document := await fetch_complete_user(
            self._authorization_client, self._mongo, self._pg, user_id
        ):
            return User(**base_processor(document))

        raise ResourceNotFoundError

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

        return await fetch_complete_user(
            self._authorization_client, self._mongo, self._pg, document["_id"]
        )

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

        async with self._mongo.create_session() as session:
            document = await create_user(
                self._mongo, handle, password, False, session=session
            )

            await self._mongo.users.update_one(
                {"_id": document["_id"]},
                {"$set": {"administrator": True}},
                session=session,
            )

        await self._authorization_client.add(
            AdministratorRoleAssignment(document["_id"], AdministratorRole.FULL)
        )

        return await fetch_complete_user(
            self._authorization_client, self._mongo, self._pg, document["_id"]
        )

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
            {"b2c_oid": b2c_user_attributes.oid}
        ):
            return await fetch_complete_user(
                self._authorization_client, self._mongo, self._pg, document["_id"]
            )

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

        user = await fetch_complete_user(
            self._authorization_client, self._mongo, self._pg, document["_id"]
        )

        return user

    @emits(Operation.UPDATE)
    async def update(self, user_id: str, data: UpdateUserRequest):
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

        if "administrator" in data:
            update["administrator"] = data["administrator"]

            role_assignment = AdministratorRoleAssignment(
                user_id, AdministratorRole.FULL
            )

            if data["administrator"]:
                await self._authorization_client.add(role_assignment)
            else:
                await self._authorization_client.remove(role_assignment)

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

            permissions = merge_group_permissions(
                await self._mongo.groups.find(
                    {"_id": {"$in": [document["groups"]]}}
                ).to_list(None)
            )

            await update_keys(
                self._mongo,
                user_id,
                document["administrator"],
                document["groups"],
                permissions,
            )

        user = await fetch_complete_user(
            self._authorization_client, self._mongo, self._pg, user_id
        )

        if user is None:
            raise ResourceNotFoundError

        return user

    async def check_users_exist(self) -> bool:
        """
        Checks that users exist.

        :returns: True if users exist otherwise False
        """
        return await self._mongo.users.count_documents({}, limit=1) > 0

    async def paginate_users(
        self,
        mongo_query: Union[Dict, MultiDictProxy[str]],
        url_query: Union[Dict, MultiDictProxy[str]],
        sort: Optional[Union[List[Tuple[str, int]], str]] = None,
        projection: Optional[Projection] = None,
        base_query: Optional[Dict] = None,
        reverse: bool = False,
    ):
        """
        Find, filter, and sort multiple users

        :param mongo_query: Query derived from user supplied
        :param url_query: Raw URL query
        :param sort: Field to sort by
        :param projection: Fields to appear on found documents
        :param base_query: Query always applied to search
        :param reverse: Reverse the sort order
        """

        return await paginate(
            self._mongo.users,
            mongo_query,
            url_query,
            sort,
            projection,
            base_query,
            reverse,
        )
