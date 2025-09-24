"""Helpers for migrating MongoDB resources to PostgreSQL."""

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from sqlalchemy import ColumnExpressionArgument, or_, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.pg.base import HasLegacyAndModernIDs

from virtool.users.pg import SQLUser

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


@asynccontextmanager
async def both_transactions(mongo: "Mongo", pg: AsyncEngine):
    """A context manager that provides a transactional both MongoDB and PostgreSQL
    transactional context.

    Don't commit the PostgreSQL transaction within the context. It will be committed
    automatically when the context exits without raising an exception.

    If any exception is raised within the context, both transactions will be rolled
    back.

    :param mongo: the application MongoDB client
    :param pg: the application PostgreSQL client

    """
    async with (
        AsyncSession(
            pg,
        ) as pg_session,
        await mongo.motor_database.client.start_session() as mongo_session,
        mongo_session.start_transaction(),
    ):
        # An exception will be raised here if there is a problem with the MongoDB
        # transaction.
        yield mongo_session, pg_session

        # Flush to check that there are no key conflicts. If there are conflicts,
        # an ``IntegrityError`` will be raised.
        await pg_session.flush()

        await pg_session.commit()


def compose_legacy_id_multi_expression(
    model: HasLegacyAndModernIDs,
    id_list: list[int | str] | set[int | str] | tuple[int | str],
) -> ColumnExpressionArgument[bool]:
    """Compose a query that will match legacy (str) and modern (int) resource ids in
    ``id_list``.

    :param id_list: a list of legacy ids
    :param model: the SQLAlchemy model to query
    :return: a MongoDB query

    """
    if not id_list:
        raise ValueError("id_list must not be empty")

    modern_ids = []
    legacy_ids = []

    for id_ in set(id_list):
        if isinstance(id_, int):
            modern_ids.append(id_)
        elif isinstance(id_, str) and id_.isdigit():
            modern_ids.append(int(id_))
        else:
            legacy_ids.append(id_)

    if legacy_ids and modern_ids:
        return or_(model.id.in_(modern_ids), model.legacy_id.in_(legacy_ids))

    if modern_ids:
        return model.id.in_(modern_ids)

    return model.legacy_id.in_(legacy_ids)


def compose_legacy_id_single_expression(
    model: HasLegacyAndModernIDs,
    id_: int | str,
) -> ColumnExpressionArgument[bool]:
    """Compose a query that will match a single legacy (str) or modern (int) resource id.

    :param model: the SQLAlchemy model to query
    :param id_: a single legacy or modern id
    :return: a column expression for the query

    """
    if isinstance(id_, int):
        return model.id == id_

    # Check if string ID is actually a stringified integer
    if isinstance(id_, str) and id_.isdigit():
        return model.id == int(id_)

    return model.legacy_id == id_


async def get_user_id_single_variants(
    pg: AsyncEngine, user_id: int | str
) -> list[int | str]:
    """Get all ID variants (modern and legacy) for MongoDB queries during migration.

    TODO: Remove this function when all user IDs are migrated away from MongoDB strings.

    :param pg: the PostgreSQL async engine
    :param user_id: a single user ID (modern int or legacy string)
    :return: list of ID variants that should match in MongoDB queries

    """
    async with AsyncSession(pg, expire_on_commit=False) as session:
        result = await session.execute(
            select(SQLUser.id, SQLUser.legacy_id).where(
                compose_legacy_id_single_expression(SQLUser, user_id),
            ),
        )
        user_row = result.first()

        if user_row is None:
            return [user_id]  # Fallback to original ID

        variants = [user_row.id]
        if user_row.legacy_id:
            variants.append(user_row.legacy_id)
        return variants


async def get_user_id_multi_variants(
    pg: AsyncEngine, user_ids: list[int | str]
) -> list[int | str]:
    """Get all ID variants for multiple users for MongoDB queries during migration.

    TODO: Remove this function when all user IDs are migrated away from MongoDB strings.

    :param pg: the PostgreSQL async engine
    :param user_ids: list of user IDs (modern int or legacy string)
    :return: flattened list of all ID variants that should match in MongoDB queries

    """
    if not user_ids:
        return []

    all_variants = []
    for user_id in user_ids:
        variants = await get_user_id_single_variants(pg, user_id)
        all_variants.extend(variants)
    return all_variants
