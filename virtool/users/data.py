import math

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy.orm import selectinload
from structlog import get_logger

import virtool.users.utils
import virtool.utils
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from virtool.data.events import Operation, emits
from virtool.groups.pg import merge_group_permissions
from virtool.models.roles import AdministratorRole
from virtool.users.models import User, UserSearchResult
from virtool.users.oas import UpdateUserRequest
from virtool.users.pg import SQLUser, SQLUserGroup
from virtool.users.settings import DEFAULT_USER_SETTINGS

logger = get_logger("data.users")


class UsersData(DataLayerDomain):
    name = "users"

    def __init__(
        self,
        pg: AsyncEngine,
    ):
        self._pg = pg

    async def find(
        self,
        page: int,
        per_page: int,
        active: bool,
        administrator: bool | None,
        term: str,
    ) -> UserSearchResult:
        """Find users.

        Optionally filter by a partial match to the users' handles or the active or
        administrator status.

        :param page: the page number
        :param per_page: the number of items per page
        :param active: whether to filter by active status
        :param administrator: whether to filter by administrator status
        :param term: a search term to filter by user handle
        """
        async with AsyncSession(self._pg) as session:
            # Build base query with eager loading
            query = (
                select(SQLUser)
                .options(
                    selectinload(SQLUser.user_group_associations).selectinload(
                        SQLUserGroup.group
                    )
                )
                .where(SQLUser.active == active)
            )

            if administrator is not None:
                if administrator:
                    query = query.where(SQLUser.administrator_role.isnot(None))
                else:
                    query = query.where(SQLUser.administrator_role.is_(None))

            if term:
                query = query.where(SQLUser.handle.ilike(f"%{term}%"))

            query = query.order_by(func.lower(SQLUser.handle))

            total_count = await session.scalar(
                select(func.count()).select_from(SQLUser)
            )

            filtered_count = await session.scalar(
                select(func.count()).select_from(query.subquery())
            )

            offset = (page - 1) * per_page if page > 1 else 0
            paginated_query = query.offset(offset).limit(per_page)

            result = await session.execute(paginated_query)
            sql_users = result.unique().scalars().all()

            items = []
            for sql_user in sql_users:
                user_dict = sql_user.to_dict()
                groups_dicts = [group.to_dict() for group in user_dict["groups"]]

                items.append(
                    User(
                        **{
                            k: v
                            for k, v in user_dict.items()
                            if k not in ["groups", "primary_group"]
                        },
                        groups=groups_dicts,
                        primary_group=user_dict["primary_group"].to_dict()
                        if user_dict["primary_group"]
                        else None,
                        permissions=merge_group_permissions(groups_dicts),
                    )
                )

            return UserSearchResult(
                items=items,
                found_count=filtered_count,
                page=page,
                page_count=math.ceil(filtered_count / per_page),
                per_page=per_page,
                total_count=total_count,
            )

    async def get(self, user_id: int) -> User:
        """Get a user by their ``user_id``.

        :param user_id: the user's ID
        :return: the user
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLUser)
                .options(
                    selectinload(SQLUser.user_group_associations).selectinload(
                        SQLUserGroup.group
                    )
                )
                .where(SQLUser.id == user_id)
            )
            sql_user = result.unique().scalar_one_or_none()

            if sql_user is None:
                raise ResourceNotFoundError

            user_dict = sql_user.to_dict()

            groups_dicts = [group.to_dict() for group in user_dict["groups"]]

        return User.parse_obj(
            {
                **user_dict,
                "groups": groups_dicts,
                "primary_group": user_dict["primary_group"].to_dict()
                if user_dict["primary_group"]
                else None,
                "permissions": merge_group_permissions(groups_dicts),
            }
        )

    async def resolve_legacy_id(self, user_id: int | str) -> int:
        """Convert a legacy string user ID to the current integer user ID.

        This method provides compatibility for sessions that may contain string legacy IDs
        from before the migration to PostgreSQL.

        TODO: Remove this method after sessions are migrated to PostgreSQL.

        :param user_id: the user's ID (int) or legacy ID (string)
        :return: the current integer user ID
        """
        if isinstance(user_id, int):
            return user_id

        # Look up the current ID from the legacy ID
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLUser.id).where(SQLUser.legacy_id == user_id)
            )
            current_id = result.scalar_one_or_none()

            if current_id is None:
                raise ResourceNotFoundError

            return current_id

    async def get_by_handle(self, handle: str) -> User:
        """Get a user by their ``handle``.

        :param handle: the user's unique handle
        :return: the user
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLUser.id).where(func.lower(SQLUser.handle) == handle.lower())
            )

            user_id = result.scalar_one_or_none()

            if user_id is None:
                raise ResourceNotFoundError

        return await self.get(user_id)

    @emits(Operation.CREATE)
    async def create(
        self,
        handle: str,
        password: str,
        force_reset: bool = False,
    ) -> User:
        """Create a new user.

        :param handle: the requested handle for the user
        :param password: a password
        :param force_reset: force the user to reset password on next login
        :return: the user document
        """
        password = virtool.users.utils.hash_password(password)

        try:
            async with AsyncSession(self._pg) as session:
                user = SQLUser(
                    force_reset=force_reset,
                    handle=handle,
                    last_password_change=virtool.utils.timestamp(),
                    legacy_id=None,
                    password=password,
                    settings=DEFAULT_USER_SETTINGS,
                )

                session.add(user)
                await session.flush()
                user_id = user.id
                await session.commit()
        except IntegrityError as e:
            if "users_handle_key" in str(e):
                raise ResourceConflictError("User already exists")
            raise

        return await self.get(user_id)

    async def create_first(self, handle: str, password: str) -> User:
        """Create the first instance user.

        :param handle: the user handle
        :param password: the password
        :return: the user created
        """
        if await self.check_users_exist():
            raise ResourceConflictError("Virtool already has at least one user")

        if handle == "virtool":
            raise ResourceConflictError("Reserved user name: virtool")

        user = await self.create(handle, password)

        await self.set_administrator_role(user.id, AdministratorRole.FULL)

        return await self.get(user.id)

    @emits(Operation.UPDATE)
    async def set_administrator_role(
        self,
        user_id: int,
        role: AdministratorRole,
    ) -> User:
        """Set a user's administrator role.

        Sets the user's legacy administrator flag to ``True`` if the ``FULL`` user role
        is set. Otherwise, sets the flag to ``False``.

        :param user_id: the id of the user to set the role of
        :param role: the administrator role
        :return: the administrator
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLUser).where(SQLUser.id == user_id),
            )

            user = result.unique().scalar_one_or_none()

            if not user:
                raise ResourceNotFoundError("User does not exist")

            await session.execute(
                update(SQLUser)
                .where(SQLUser.id == user.id)
                .values(administrator_role=role),
            )
            await session.commit()

        return await self.get(user_id)

    @emits(Operation.UPDATE)
    async def update(self, user_id: int, data: UpdateUserRequest) -> User:
        """Update a user.

        Sessions and API keys are updated as well.

        :param user_id: the ID of the user to update
        :param data: the update data object
        :return: the updated user
        """
        data = data.dict(exclude_unset=True)

        values = {}

        if "active" in data:
            values.update({"active": data["active"], "invalidate_sessions": True})

        if "force_reset" in data:
            values.update(
                {"force_reset": data["force_reset"], "invalidate_sessions": True},
            )

        if "password" in data:
            values.update(
                {
                    "password": virtool.users.utils.hash_password(data["password"]),
                    "last_password_change": virtool.utils.timestamp(),
                    "invalidate_sessions": True,
                },
            )

        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLUser).where(SQLUser.id == user_id),
            )

            user = result.unique().scalar_one_or_none()

            if not user:
                raise ResourceNotFoundError

            if values:
                await session.execute(
                    update(SQLUser).where(SQLUser.id == user.id).values(**values),
                )

            if "groups" in data:
                await session.execute(
                    delete(SQLUserGroup).where(SQLUserGroup.user_id == user.id),
                )

                if data["groups"]:
                    # Don't do this if the new groups list is not empty.
                    await session.execute(
                        insert(SQLUserGroup).values(
                            [
                                {"user_id": user.id, "group_id": group_id}
                                for group_id in data["groups"]
                            ],
                        ),
                    )

            if "primary_group" in data:
                # Try to set the specific group as primary (only if relationship exists)
                result = await session.execute(
                    update(SQLUserGroup)
                    .where(
                        (SQLUserGroup.user_id == user.id)
                        & (SQLUserGroup.group_id == data["primary_group"])
                    )
                    .values(primary=True)
                )

                if result.rowcount:
                    # Successfully set as primary, now clear others
                    await session.execute(
                        update(SQLUserGroup)
                        .where(
                            (SQLUserGroup.user_id == user.id)
                            & (SQLUserGroup.group_id != data["primary_group"])
                        )
                        .values(primary=False)
                    )
                else:
                    raise ResourceConflictError("User is not a member of group")

            await session.commit()

        return await self.get(user_id)

    async def check_administrator_role(
        self, user_id: int, required_role: AdministratorRole
    ) -> bool:
        """Check if a user has the required administrator role or higher.

        :param user_id: the user's ID
        :param required_role: the minimum administrator role required
        :return: True if the user has the required role or higher, False otherwise
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLUser.administrator_role).where(SQLUser.id == user_id),
            )
            user_role = result.scalar_one_or_none()

            if user_role is None:
                return False

            # Define role hierarchy: FULL has highest privileges
            role_hierarchy = {
                AdministratorRole.BASE: 1,
                AdministratorRole.USERS: 2,
                AdministratorRole.SETTINGS: 2,
                AdministratorRole.SPACES: 2,
                AdministratorRole.FULL: 3,
            }

            user_level = role_hierarchy.get(user_role, 0)
            required_level = role_hierarchy.get(required_role, 0)

            return user_level >= required_level

    async def check_users_exist(self) -> bool:
        """Check that users exist.

        :returns: True if users exist otherwise False
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(1).select_from(SQLUser).limit(1),
            )
            return result.scalar() is not None

    async def validate_password(self, user_id: int, password: str) -> bool:
        """Validate a user's password.

        :param user_id: the Postgres user ID
        :param password: the password to validate
        :return: True if valid, False otherwise
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLUser.password).where(SQLUser.id == user_id)
            )
            hashed = result.scalar_one_or_none()

            if not hashed:
                return False

            return virtool.users.utils.check_password(password, hashed)
