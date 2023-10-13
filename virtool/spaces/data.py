from typing import Union, List

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool_core.models.roles import (
    SpaceRole,
    SpaceLabelRole,
    SpaceProjectRole,
    SpaceReferenceRole,
    SpaceSampleRole,
    SpaceSubtractionRole,
    SpaceUploadRole,
)
from virtool_core.models.spaces import SpaceMinimal, Space, MemberSearchResult
from virtool_core.utils import document_enum

import virtool.utils
from virtool.authorization.client import AuthorizationClient
from virtool.authorization.relationships import (
    SpaceMembership,
    UserRoleAssignment,
)
from virtool.data.errors import (
    ResourceNotFoundError,
    ResourceConflictError,
)
from virtool.mongo.core import Mongo
from virtool.mongo.utils import id_exists
from virtool.spaces.models import SQLSpace
from virtool.spaces.oas import (
    UpdateSpaceRequest,
    UpdateMemberRequest,
)
from virtool.spaces.utils import (
    remove_user_roles,
    format_space_user,
    format_space_users,
)

AVAILABLE_ROLES = [
    {"id": role, "name": role.capitalize(), "description": role.__doc__}
    for enum in [
        SpaceRole,
        SpaceLabelRole,
        SpaceProjectRole,
        SpaceReferenceRole,
        SpaceSampleRole,
        SpaceSubtractionRole,
        SpaceUploadRole,
    ]
    for role in document_enum(enum)
]


class SpacesData:
    def __init__(
        self, authorization_client: AuthorizationClient, db: "Mongo", pg: AsyncEngine
    ):
        self._authorization_client = authorization_client
        self._db = db
        self._pg = pg

    async def find(self, user_id: str) -> List[SpaceMinimal]:
        """
        Find all spaces that the user is a member of.

        :param user_id: the user ID
        :return: a list of spaces.

        """
        space_ids = await self._authorization_client.list_user_spaces(user_id)

        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLSpace).filter(SQLSpace.id.in_(space_ids))
            )

            spaces = result.scalars().all()

        return [SpaceMinimal(**space.to_dict()) for space in spaces]

    async def get(self, space_id: int) -> Space:
        """
        Get the complete representation of a space.

        :param space_id: the space id.
        :return: the space

        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(SQLSpace).filter_by(id=space_id))

            space = result.scalar()

            if space is None:
                raise ResourceNotFoundError

        return Space(
            **{
                **space.to_dict(),
                "members": await format_space_users(
                    self._authorization_client, self._db, space_id
                ),
            }
        )

    async def update(self, space_id: int, data: UpdateSpaceRequest) -> Space:
        """
        Update a space.

        :param space_id: the space id.
        :param data: updates to the space.
        :return: the space
        """
        data = data.dict(exclude_unset=True)

        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(SQLSpace).filter_by(id=space_id))
            space = result.scalar()

            if space is None:
                raise ResourceNotFoundError

            if "name" in data:
                space.name = data["name"]

            if "description" in data:
                space.description = data["description"]

            space.updated_at = virtool.utils.timestamp()

            row = space.to_dict()

            try:
                await session.commit()
            except IntegrityError:
                raise ResourceConflictError("Space name already exists.")

        return Space(
            **{
                **row,
                "members": await format_space_users(
                    self._authorization_client, self._db, space_id
                ),
            }
        )

    async def find_members(self, space_id: int) -> MemberSearchResult:
        """
        Find members of a space.

        :param space_id: the space id.
        :return: a list of space members.

        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(SQLSpace).filter_by(id=space_id))
            space = result.scalar()

            if space is None:
                raise ResourceNotFoundError

        return MemberSearchResult(
            **{
                "items": await format_space_users(
                    self._authorization_client, self._db, space_id
                ),
                "available_roles": AVAILABLE_ROLES,
            }
        )

    async def update_member(
        self, space_id: int, member_id: int | str, data: UpdateMemberRequest
    ):
        """
        Change the roles of a member.

        :param space_id: the space id.
        :param member_id: the id of the user to update.
        :param data: the updates to the member
        :return: the space
        """

        data = data.dict(exclude_unset=True)

        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(SQLSpace).filter_by(id=space_id))
            space = result.scalar()

            if space is None or not await id_exists(self._db.users, member_id):
                raise ResourceNotFoundError

        if "role" in data and data["role"]:
            await self._authorization_client.add(
                SpaceMembership(member_id, space_id, SpaceRole(data["role"]))
            )

        if "label" in data:
            await remove_user_roles(
                self._authorization_client, member_id, space_id, [SpaceLabelRole]
            )

            if data["label"]:
                await self._authorization_client.add(
                    UserRoleAssignment(member_id, space_id, data["label"])
                )

        if "project" in data:
            await remove_user_roles(
                self._authorization_client, member_id, space_id, [SpaceProjectRole]
            )

            if data["project"]:
                await self._authorization_client.add(
                    UserRoleAssignment(member_id, space_id, data["project"])
                )

        if "reference" in data:
            await remove_user_roles(
                self._authorization_client, member_id, space_id, [SpaceReferenceRole]
            )

            if data["reference"]:
                await self._authorization_client.add(
                    UserRoleAssignment(member_id, space_id, data["reference"])
                )

        if "sample" in data:
            await remove_user_roles(
                self._authorization_client, member_id, space_id, [SpaceSampleRole]
            )

            if data["sample"]:
                await self._authorization_client.add(
                    UserRoleAssignment(member_id, space_id, data["sample"])
                )

        if "subtraction" in data:
            await remove_user_roles(
                self._authorization_client, member_id, space_id, [SpaceSubtractionRole]
            )

            if data["subtraction"]:
                await self._authorization_client.add(
                    UserRoleAssignment(member_id, space_id, data["subtraction"])
                )

        if "upload" in data:
            await remove_user_roles(
                self._authorization_client, member_id, space_id, [SpaceUploadRole]
            )

            if data["upload"]:
                await self._authorization_client.add(
                    UserRoleAssignment(member_id, space_id, data["upload"])
                )

        members = await self._authorization_client.list_space_users(space_id)

        for member in members:
            if member[0] == member_id:
                return format_space_user(
                    await self._db.users.find_one(member_id), member[1]
                )

        raise ResourceNotFoundError

    async def remove_member(self, space_id: int, member_id: Union[str, int]):
        """
        Remove a member from the space.


        :param space_id: the space id.
        :param member_id: the user id.
        :return: the space

        """

        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(SQLSpace).filter_by(id=space_id))
            space = result.scalar()

            if space is None or not await id_exists(self._db.users, member_id):
                raise ResourceNotFoundError

        await remove_user_roles(
            self._authorization_client,
            member_id,
            space_id,
            [
                SpaceRole,
                SpaceLabelRole,
                SpaceProjectRole,
                SpaceReferenceRole,
                SpaceSampleRole,
                SpaceSubtractionRole,
                SpaceUploadRole,
            ],
        )
