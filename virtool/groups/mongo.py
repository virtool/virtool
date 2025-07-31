"""Database utilities for groups."""

from motor.motor_asyncio import AsyncIOMotorClientSession
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.groups.pg import SQLGroup
from virtool.mongo.core import Mongo


async def update_member_users_and_api_keys(
    mongo: Mongo,
    mongo_session: AsyncIOMotorClientSession,
    pg_session: AsyncSession,
    group_id: int,
):
    """For the ``group_id``, update member users ``groups`` and ``primary_group`` fields
    and update their API key permissions.

    This function should be called after a group is updated or deleted.

    TODO: Drop legacy group id support when we fully migrate to Postgres.

    :param mongo: the application MongoDB client
    :param mongo_session: the active MongoDB session
    :param pg_session: the active Postgres session
    :param group_id: the id of the group that was updated
    """
    groups = (await pg_session.execute(select(SQLGroup))).scalars().all()

    # All extant legacy and modern group ids.
    all_group_ids: set[int | str | None] = {group.id for group in groups} | {
        group.legacy_id for group in groups
    }

    all_group_ids.discard(None)

    # Either the modern group id or both. Will not be only the legacy id.
    ids_to_query = [group_id]

    for group in groups:
        if group.id == group_id and group.legacy_id is not None:
            ids_to_query.append(group.legacy_id)
            break

    async for user in mongo.users.find(
        {"groups": {"$in": ids_to_query}},
        ["groups", "permissions", "primary_group"],
        session=mongo_session,
    ):
        new_group_ids = {
            group_id for group_id in user["groups"] if group_id in all_group_ids
        }

        if new_group_ids != set(user["groups"]):
            update = {
                "groups": list(new_group_ids),
            }

            if user["primary_group"] not in all_group_ids:
                update["primary_group"] = None

            user = await mongo.users.find_one_and_update(
                {"_id": user["_id"]},
                {"$set": update},
                projection=["_id", "administrator", "groups"],
                session=mongo_session,
            )
