"""Database utilities for managing users.

TODO: Drop legacy group id support when we fully migrate to integer ids.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceConflictError
from virtool.data.topg import compose_legacy_id_expression
from virtool.groups.pg import SQLGroup

ATTACH_PROJECTION = ("_id", "handle")


async def compose_groups_update(
    pg: AsyncEngine,
    group_ids: list[int | str],
    primary_group: int | str | None,
) -> dict[str, list[int | str]]:
    """Compose an update dict for updating the list of groups a user is a member of.

    Any legacy string ids will be converted to modern integer ids. A
    ``ResourceConflictError`` will be raised if any of the ``group_ids`` do not exist.

    :param pg: the application Postgres client
    :param group_ids: the group ids to include in update
    :return: an update
    """
    if not group_ids:
        return {"groups": [], "primary_group": None}

    async with AsyncSession(pg) as session:
        expr = compose_legacy_id_expression(SQLGroup, group_ids)

        result = await session.execute(
            select(SQLGroup.id, SQLGroup.legacy_id).where(expr),
        )

        existing_group_ids = [id_ for row in result.all() for id_ in row]

    non_existent_group_ids = {
        group_id for group_id in group_ids if group_id not in existing_group_ids
    }

    if non_existent_group_ids:
        # Sort the ids so that the error message is consistent.
        repr_ids = sorted([repr(id_) for id_ in non_existent_group_ids])
        raise ResourceConflictError(f"Non-existent groups: {', '.join(repr_ids)}")

    update = {"groups": group_ids}

    if primary_group not in group_ids:
        update["primary_group"] = None

    return update
