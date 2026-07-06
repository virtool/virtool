"""Helpers for migrating MongoDB resources to PostgreSQL."""

from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, TypeVar

from pymongo.errors import OperationFailure
from sqlalchemy import ColumnExpressionArgument, ScalarSelect, or_, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.pg.base import HasLegacyAndModernIDs

if TYPE_CHECKING:
    from motor.motor_asyncio import AsyncIOMotorClientSession as ClientSession

    from virtool.mongo.core import Mongo

T = TypeVar("T")


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


async def retry_both_transactions(
    mongo: "Mongo",
    pg: AsyncEngine,
    func: Callable[["ClientSession", AsyncSession], Awaitable[T]],
    retries: int = 3,
) -> T:
    """Execute a function within a transactional context for both MongoDB and
    PostgreSQL, with retries for transient transaction errors.

    If a transient transaction error occurs, the transaction will be retried up to
    ``retries`` times.

    :param mongo: the application MongoDB client
    :param pg: the application PostgreSQL client
    :param func: the function to execute within the transaction
    :param retries: the number of times to retry the transaction

    """
    for i in range(retries):
        try:
            async with both_transactions(mongo, pg) as (mongo_session, pg_session):
                return await func(mongo_session, pg_session)
        except OperationFailure as error:
            if error.has_error_label("TransientTransactionError") and i < retries - 1:
                continue
            raise


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


def compose_legacy_id_subquery(
    model: HasLegacyAndModernIDs,
    id_: int | str,
) -> ScalarSelect:
    """Build a scalar subquery resolving a legacy (str) or modern (int) resource id to
    the integer ``id`` of the matching row in ``model``.

    Use this to filter or join on a not-yet-migrated FK column (eg. a legacy Mongo
    string id) against a table that has already been migrated to Postgres.

    :param model: the SQLAlchemy model to query
    :param id_: a single legacy or modern id
    :return: a scalar subquery yielding the matching integer id

    """
    return (
        select(model.id)
        .where(compose_legacy_id_single_expression(model, id_))
        .scalar_subquery()
    )


async def resolve_legacy_id(
    session: AsyncSession,
    model: HasLegacyAndModernIDs,
    id_: int | str,
) -> int | None:
    """Resolve a legacy (str) or modern (int) resource id to the integer ``id`` of the
    matching row in ``model``.

    :param session: an active Postgres session
    :param model: the SQLAlchemy model to query
    :param id_: a single legacy or modern id
    :return: the matching integer id, or ``None`` if no row matches

    """
    return (
        await session.execute(
            select(model.id).where(compose_legacy_id_single_expression(model, id_)),
        )
    ).scalar_one_or_none()
