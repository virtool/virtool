"""
Helpers for migrating MongoDB resources to PostgreSQL.

"""
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from sqlalchemy import or_, ColumnExpressionArgument
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.pg.base import HasLegacyAndModernIDs

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


@asynccontextmanager
async def both_transactions(mongo: "Mongo", pg: AsyncEngine):
    """
    A context manager that provides a transactional both MongoDB and PostgreSQL
    transactional context.

    Don't commit the PostgreSQL transaction within the context. It will be committed
    automatically when the context exits without raising an exception.

    If any exception is raised within the context, both transactions will be rolled
    back.

    :param mongo: the application MongoDB client
    :param pg: the application PostgreSQL client

    """
    async with AsyncSession(
        pg
    ) as pg_session, await mongo.motor_client.client.start_session() as mongo_session, mongo_session.start_transaction():
        # An exception will be raised here if there is a problem with the MongoDB
        # transaction.
        yield mongo_session, pg_session

        # Flush to check that there are no key conflicts. If there are conflicts,
        # an ``IntegrityError`` will be raised.
        await pg_session.flush()

        await pg_session.commit()


def compose_legacy_id_expression(
    model: HasLegacyAndModernIDs,
    id_list: list[int | str] | set[int | str] | tuple[int | str],
) -> ColumnExpressionArgument[bool]:
    """
    Compose a query that will match legacy (str) and modern (int) resource ids in
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
        else:
            legacy_ids.append(id_)

    if legacy_ids and modern_ids:
        return or_(model.id.in_(modern_ids), model.legacy_id.in_(legacy_ids))

    if modern_ids:
        return model.id.in_(modern_ids)

    return model.legacy_id.in_(legacy_ids)
