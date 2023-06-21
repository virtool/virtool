"""
Helpers for migrating MongoDB resources to PostgreSQL.

"""
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

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
    ) as pg_session, await mongo.motor_client.client.start_session() as mongo_session:
        async with mongo_session.start_transaction():
            # An exception will be raised here if there is a problem with the MongoDB
            # transaction.
            yield mongo_session, pg_session

            # Flush to check that there are no key conflicts. If there are conflicts,
            # an ``IntegrityError`` will be raised.
            await pg_session.flush()

            await pg_session.commit()
