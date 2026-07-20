"""Helpers for migrating MongoDB resources to PostgreSQL."""

from sqlalchemy import ColumnExpressionArgument, ScalarSelect, or_, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.pg.base import HasLegacyAndModernIDs


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


async def compose_legacy_id_mongo_match(
    pg: AsyncEngine,
    model: HasLegacyAndModernIDs,
    id_: int | str,
) -> dict:
    """Build a Mongo match value for an embedded reference that may hold either the
    legacy string id or the integer primary key of ``model``.

    While a collection is mid-migration, embedded ids may be stored as the legacy
    Mongo string or as the integer ``model`` primary key, so both forms must match.
    The input ``id_`` may itself be in either form, so both the integer primary key
    and the legacy string are resolved from the matching row and included.

    :param pg: the application PostgreSQL engine
    :param model: the SQLAlchemy model the embedded id points at
    :param id_: a single legacy or modern id
    :return: a Mongo ``$in`` match value covering both id forms
    """
    async with AsyncSession(pg) as session:
        row = (
            await session.execute(
                select(model.id, model.legacy_id).where(
                    compose_legacy_id_single_expression(model, id_),
                ),
            )
        ).one_or_none()

    values: list[int | str] = [id_]

    if row is not None:
        for value in row:
            if value is not None and value not in values:
                values.append(value)

    return {"$in": values}


async def compose_legacy_id_multi_mongo_match(
    pg: AsyncEngine,
    model: HasLegacyAndModernIDs,
    id_list: list[int | str] | set[int | str] | tuple[int | str],
) -> dict:
    """Build a Mongo match value for an embedded reference that may hold either the
    legacy string id or the integer primary key of ``model``, for any id in ``id_list``.

    The multi-id counterpart of :func:`compose_legacy_id_mongo_match`. Each input id
    may itself be in either form, so both the integer primary key and the legacy string
    of every matching row are included, letting a mid-migration collection with mixed
    id forms be matched in full. An empty ``id_list`` yields an empty ``$in`` that
    matches nothing.

    :param pg: the application PostgreSQL engine
    :param model: the SQLAlchemy model the embedded id points at
    :param id_list: legacy or modern ids
    :return: a Mongo ``$in`` match value covering both id forms
    """
    values: list[int | str] = list(dict.fromkeys(id_list))

    if id_list:
        async with AsyncSession(pg) as session:
            rows = await session.execute(
                select(model.id, model.legacy_id).where(
                    compose_legacy_id_multi_expression(model, id_list),
                ),
            )

        for row in rows:
            for value in row:
                if value is not None and value not in values:
                    values.append(value)

    return {"$in": values}
