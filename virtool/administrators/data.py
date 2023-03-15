from typing import TYPE_CHECKING

from virtool_core.models.roles import AdministratorRole
from virtool_core.models.administrator import Administrator, AdministratorSearch, AdministratorMinimal
from virtool_core.utils import document_enum

from virtool.administrators.oas import (
    CreateAdministratorRequest,
    UpdateAdministratorRequest,
)
from virtool.authorization.client import AuthorizationClient
from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.data.errors import (
    ResourceNotFoundError,
)

if TYPE_CHECKING:
    from virtool.mongo.core import DB


AVAILABLE_ROLES = [
    {"id": role, "name": role.capitalize(), "description": role.__doc__}
    for role in document_enum(AdministratorRole)
]


class AdministratorsData:
    def __init__(self, authorization_client: AuthorizationClient, db: "DB"):
        self._authorization_client = authorization_client
        self._db = db

    async def find(self) -> AdministratorSearch:
        """
        List all administrators.

        :return: a list of all administrators

        """
        admin_list = await self._authorization_client.list_administrators()

        return AdministratorSearch(
            **{
                "items": [
                    AdministratorMinimal(
                        **{
                            **await self._db.users.find_one(admin_tuple[0]),
                            "role": AdministratorRole(admin_tuple[1]),
                        }
                    )
                    for admin_tuple in admin_list
                ],
                "available_roles": AVAILABLE_ROLES,
            }
        )

    async def get(self, user_id: str) -> Administrator:
        """
        Get an administrator.

        :param user_id: the user ID
        :return: the administrator
        """

        if admin_tuple := await self._db.users.find_one(
            user_id
        ) and await self._authorization_client.get_administrator(user_id):

            return Administrator(
                **{
                    **await self._db.users.find_one(user_id),
                    "role": AdministratorRole(admin_tuple[1]),
                    "available_roles": AVAILABLE_ROLES,
                }
            )

        raise ResourceNotFoundError()

    async def create(self, data: CreateAdministratorRequest) -> Administrator:
        """
        Add a user as an administrator with a given role.

        Set the user's administrator flag to true if given the full role.

        :param data: fields to add a user as an administrator
        :return: the administrator
        """

        if await self._db.users.find_one(data.user_id):

            if data.role == AdministratorRole.FULL:
                async with self._db.create_session() as session:
                    await self._db.users.update_one(
                        {"_id": data.user_id},
                        {"$set": {"administrator": True}},
                        session=session,
                    )

            await self._authorization_client.add(
                AdministratorRoleAssignment(data.user_id, AdministratorRole(data.role))
            )

            return Administrator(
                **{
                    **await self._db.users.find_one(data.user_id),
                    "role": AdministratorRole(data.role),
                    "available_roles": AVAILABLE_ROLES,
                }
            )

        raise ResourceNotFoundError()

    async def update(
        self, user_id: str, data: UpdateAdministratorRequest
    ) -> Administrator:
        """
        Update an administrator's role.

        Set the user's administrator flag to true if given the full role.

        Set the user's administrator flag to false if the full role is removed.

        :param user_id: the user ID of the administrator to update
        :param data: updates to the administrator's current role
        :return: the administrator
        """

        if await self._db.users.find_one(
            user_id
        ) and await self._authorization_client.get_administrator(user_id):

            async with self._db.create_session() as session:
                await self._db.users.update_one(
                    {"_id": user_id},
                    {
                        "$set": {
                            "administrator": data.role == AdministratorRole.FULL
                        }
                    },
                    session=session,
                )

            await self._authorization_client.add(
                AdministratorRoleAssignment(user_id, AdministratorRole(data.role))
            )

            return Administrator(
                **{
                    **await self._db.users.find_one(user_id),
                    "role": AdministratorRole(data.role),
                    "available_roles": AVAILABLE_ROLES,
                }
            )

        raise ResourceNotFoundError()

    async def delete(self, user_id: str):
        """
        Remove an administrator.

        :param user_id: the user ID
        """
        if admin_tuple := await self._db.users.find_one(
            user_id
        ) and await self._authorization_client.get_administrator(user_id):

            async with self._db.create_session() as session:
                await self._db.users.update_one(
                    {"_id": user_id},
                    {"$set": {"administrator": False}},
                    session=session,
                )

            await self._authorization_client.remove(
                AdministratorRoleAssignment(user_id, AdministratorRole(admin_tuple[1]))
            )

            return

        raise ResourceNotFoundError()
